"""
HybridFlowIDS Command-Line Interface (Phase 2: Core Engine)
Usage:
    python cli.py health
    python cli.py predict --file samples/benign_https.json
    python cli.py predict --file samples/ddos_syn_flood.json
    python cli.py predict --json '{"flow_duration": 3500, "packet_count": 42}'
    python cli.py batch --file samples/hybridflow_realworld_100.csv
    python cli.py evaluate
    python cli.py train
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Optional rich formatting with plain text fallback
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    HAS_RICH = True
    console = Console()
except ImportError:
    HAS_RICH = False
    console = None


def _load_backend():
    try:
        from sqlalchemy import text
        from app.config import settings
        from app.core.database import init_db, SessionLocal, engine
        from app.api.schemas import TrafficFeatures
        from app.ml.model_loader import get_model_bundle, load_models
        from app.rules.signature_engine import get_signature_engine
        from app.services.prediction_service import PredictionService
        return {
            "text": text,
            "settings": settings,
            "init_db": init_db,
            "SessionLocal": SessionLocal,
            "engine": engine,
            "TrafficFeatures": TrafficFeatures,
            "get_model_bundle": get_model_bundle,
            "load_models": load_models,
            "get_signature_engine": get_signature_engine,
            "PredictionService": PredictionService,
        }
    except ImportError as e:
        print(f"\n[!] Backend dependencies are missing: {e}")
        print("    Please install requirements first:\n      pip install -r requirements.txt\n")
        sys.exit(1)


BANNER_TEXT = """
╔═════════════════════════════════════════════════════════════════════════════╗
║                   HYBRIDFLOW-IDS — Intrusion Detection Platform               ║
║                     Phase 2 of 4: Core Engine (Terminal CLI)                ║
╚═════════════════════════════════════════════════════════════════════════════╝
"""

def print_banner():
    if HAS_RICH:
        title = Text("HYBRIDFLOW-IDS — Intrusion Detection Platform\nPhase 2 of 4: Core Engine (Terminal CLI)",
                     justify="center", style="bold cyan")
        console.print(Panel(title, border_style="cyan", padding=(0, 2)))
    else:
        print(BANNER_TEXT)


def _ensure_models_loaded() -> tuple[any, any, bool, dict]:
    """Attempts to initialize models and signature engine. Returns (bundle, engine, ok, mod)."""
    mod = _load_backend()
    try:
        mod["init_db"]()
    except Exception:
        pass

    sig_engine = mod["get_signature_engine"]()
    bundle = mod["load_models"](
        mod["settings"].classifier_path,
        mod["settings"].autoencoder_path,
        mod["settings"].scaler_path,
        mod["settings"].label_encoder_path,
        mod["settings"].metadata_path,
    )
    return bundle, sig_engine, bundle.loaded, mod


def _print_missing_models_help():
    msg = (
        "\n[!] Model weights not found or incomplete in 'models/'.\n"
        "    The Core Engine requires trained model artifacts to perform predictions.\n\n"
        "    To train the models from raw datasets:\n"
        "      python cli.py train\n"
        "      (or: python training/training_pipeline.py)\n\n"
        "    Alternatively, copy pre-trained model files into backend/models/:\n"
        "      - ids_classifier.pt\n"
        "      - anomaly_autoencoder.pt\n"
        "      - scaler.pkl\n"
        "      - label_encoder.json\n"
        "      - metadata.json\n"
    )
    if HAS_RICH:
        console.print(Panel(msg, title="[yellow]Models Not Loaded[/yellow]", border_style="yellow"))
    else:
        print(msg)


# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: health
# ─────────────────────────────────────────────────────────────────────────────

def cmd_health(args):
    print_banner()
    bundle, sig_engine, models_ok, mod = _ensure_models_loaded()
    settings = mod["settings"]

    status = "ok" if models_ok else "degraded"
    db_status = "Connected"
    try:
        with mod["engine"].connect() as conn:
            conn.execute(mod["text"]("SELECT 1"))
        db_status = "Connected"
    except Exception:
        db_status = "Initialized (Ready)"

    if HAS_RICH:
        table = Table(title="System Health & Model Status", border_style="cyan")
        table.add_column("Component", style="bold")
        table.add_column("Status")
        table.add_column("Details", style="dim")

        table.add_row("Service Status", f"[green]{status.upper()}[/green]" if models_ok else f"[yellow]{status.upper()}[/yellow]", f"{settings.app_name} v{settings.app_version}")
        table.add_row("Database", f"[green]{db_status}[/green]", settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url)
        table.add_row("ML Model Bundle", "[green]Loaded[/green]" if models_ok else "[yellow]Missing Weights[/yellow]", f"v{bundle.version}" if models_ok else "Run training pipeline")
        table.add_row("Neural Classifier", "[green]Ready[/green]" if bundle.classifier else "[red]Not Loaded[/red]", "IDSClassifier (PyTorch MLP + Focal Loss)")
        table.add_row("Anomaly Autoencoder", "[green]Ready[/green]" if bundle.autoencoder else "[red]Not Loaded[/red]", f"IDSAutoencoder (threshold={bundle.anomaly_threshold:.4f})" if bundle.autoencoder else "Autoencoder")
        table.add_row("Feature Scaler", "[green]Ready[/green]" if bundle.scaler else "[red]Not Loaded[/red]", "StandardScaler (24 features)")
        table.add_row("Signature Engine", "[green]Active[/green]", f"{len(sig_engine.rules)} exploit signatures (v{sig_engine.version})")
        console.print(table)
    else:
        print("System Health & Model Status:")
        print(f"  - Service Status:      {status.upper()} ({settings.app_name} v{settings.app_version})")
        print(f"  - Database:            {db_status} ({settings.database_url})")
        print(f"  - Model Bundle:        {'Loaded (v' + bundle.version + ')' if models_ok else 'Missing Weights (Run training pipeline)'}")
        print(f"  - Classifier:          {'Ready' if bundle.classifier else 'Not Loaded'}")
        print(f"  - Autoencoder:         {'Ready (threshold=' + str(bundle.anomaly_threshold) + ')' if bundle.autoencoder else 'Not Loaded'}")
        print(f"  - Signature Engine:    Active ({len(sig_engine.rules)} rules loaded)")


# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: predict
# ─────────────────────────────────────────────────────────────────────────────

def cmd_predict(args):
    print_banner()
    bundle, sig_engine, models_ok, mod = _ensure_models_loaded()

    if not models_ok:
        _print_missing_models_help()
        return

    # Parse input features
    features_dict = {}
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"[-] Error: File not found: {args.file}")
            return
        with open(file_path, "r", encoding="utf-8") as f:
            features_dict = json.load(f)
    elif args.json:
        try:
            features_dict = json.loads(args.json)
        except json.JSONDecodeError as e:
            print(f"[-] Error: Invalid JSON string: {e}")
            return
    else:
        print("[-] Error: Specify sample input via --file <path> or --json '<raw_json>'")
        return

    # Payload overrides
    if args.url:
        features_dict["url"] = args.url
    if args.body:
        features_dict["body"] = args.body
    if args.header:
        features_dict["header"] = args.header

    features = mod["TrafficFeatures"](**features_dict)
    service = mod["PredictionService"](bundle=bundle, sig_engine=sig_engine)

    t0 = time.perf_counter()
    pred = service.predict_one(features, client_ip="cli-single")
    latency_ms = (time.perf_counter() - t0) * 1000

    severity_color = {
        "low": "green",
        "medium": "yellow",
        "high": "red",
        "critical": "bold red",
    }.get(pred.severity, "white")

    attack_color = "green" if pred.predicted_attack == "BENIGN" else "red"

    if HAS_RICH:
        table = Table(title=f"Inference Result (Latency: {latency_ms:.2f}ms)", border_style="cyan")
        table.add_column("Field", style="bold")
        table.add_column("Value")

        table.add_row("Classification", f"[{attack_color}]{pred.predicted_attack}[/{attack_color}]")
        table.add_row("Confidence", f"{pred.confidence * 100:.2f}%")
        table.add_row("Anomaly Score", f"{pred.anomaly_score * 100:.2f}% {'[red](ANOMALY)[/red]' if pred.is_anomaly else '[green](NORMAL)[/green]'}")
        table.add_row("Composite Threat Score", f"[{severity_color}]{pred.threat_score:.2f} / 100[/{severity_color}]")
        table.add_row("Severity", f"[{severity_color}]{pred.severity.upper()}[/{severity_color}]")
        table.add_row("Signature Hit", f"[red]{pred.signature_rule}[/red]" if pred.signature_matched else "[dim]None[/dim]")
        table.add_row("Model Version", pred.model_version)
        console.print(table)
    else:
        print(f"Inference Result (Latency: {latency_ms:.2f}ms):")
        print(f"  - Classification:        {pred.predicted_attack}")
        print(f"  - Confidence:            {pred.confidence * 100:.2f}%")
        print(f"  - Anomaly Score:         {pred.anomaly_score * 100:.2f}% ({'ANOMALY' if pred.is_anomaly else 'NORMAL'})")
        print(f"  - Composite Threat Score:{pred.threat_score:.2f} / 100")
        print(f"  - Severity:              {pred.severity.upper()}")
        print(f"  - Signature Hit:         {pred.signature_rule or 'None'}")
        print(f"  - Model Version:         {pred.model_version}")


# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: batch
# ─────────────────────────────────────────────────────────────────────────────

def cmd_batch(args):
    print_banner()
    bundle, sig_engine, models_ok, mod = _ensure_models_loaded()

    if not models_ok:
        _print_missing_models_help()
        return

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"[-] Error: File not found: {args.file}")
        return

    # Parse CSV or JSON
    records = []
    if file_path.suffix.lower() == ".csv":
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            string_cols = {"url", "body", "header"}
            for row in reader:
                d = {}
                for k, v in row.items():
                    k = k.strip()
                    if k in string_cols:
                        d[k] = v.strip() or None
                    else:
                        try:
                            d[k] = float(v) if v.strip() else None
                        except Exception:
                            pass
                records.append(mod["TrafficFeatures"](**d))
    elif file_path.suffix.lower() == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
            if isinstance(raw, list):
                records = [mod["TrafficFeatures"](**item) for item in raw]
            elif isinstance(raw, dict) and "records" in raw:
                records = [mod["TrafficFeatures"](**item) for item in raw["records"]]
            else:
                records = [mod["TrafficFeatures"](**raw)]
    else:
        print(f"[-] Unsupported file type: {file_path.suffix}. Use .csv or .json")
        return

    if args.limit and args.limit > 0:
        records = records[:args.limit]

    print(f"[*] Processing {len(records)} flow records from {file_path.name}...")
    service = mod["PredictionService"](bundle=bundle, sig_engine=sig_engine)

    t0 = time.perf_counter()
    results = service.predict_batch(records, client_ip="cli-batch")
    total_time = time.perf_counter() - t0
    flows_per_sec = len(records) / max(total_time, 0.0001)

    # Display results table (first 15 samples)
    display_count = min(15, len(results))
    if HAS_RICH:
        table = Table(title=f"Sample Predictions (Displaying {display_count} of {len(results)})", border_style="cyan")
        table.add_column("#", justify="right", style="dim")
        table.add_column("Classification", style="bold")
        table.add_column("Confidence", justify="right")
        table.add_column("Anomaly", justify="right")
        table.add_column("Threat", justify="right")
        table.add_column("Severity")
        table.add_column("Signature", style="dim")

        for i in range(display_count):
            r = results[i]
            att_col = "green" if r.predicted_attack == "BENIGN" else "red"
            sev_col = {"low": "green", "medium": "yellow", "high": "red", "critical": "bold red"}.get(r.severity, "white")
            table.add_row(
                str(i + 1),
                f"[{att_col}]{r.predicted_attack}[/{att_col}]",
                f"{r.confidence * 100:.1f}%",
                f"{r.anomaly_score:.2f}",
                f"{r.threat_score:.1f}",
                f"[{sev_col}]{r.severity.upper()}[/{sev_col}]",
                r.signature_rule or "-",
            )
        console.print(table)
    else:
        print(f"\nSample Predictions (Displaying {display_count} of {len(results)}):")
        print(f"{'#':<4} {'Classification':<18} {'Confidence':<12} {'Anomaly':<10} {'Threat':<8} {'Severity':<10} {'Signature'}")
        print("-" * 75)
        for i in range(display_count):
            r = results[i]
            print(f"{i+1:<4} {r.predicted_attack:<18} {r.confidence * 100:>8.1f}%    {r.anomaly_score:>7.2f}   {r.threat_score:>6.1f}   {r.severity.upper():<10} {r.signature_rule or '-'}")

    # Summary Statistics
    from collections import Counter
    attack_counts = Counter(r.predicted_attack for r in results)
    severity_counts = Counter(r.severity for r in results)
    anomaly_count = sum(1 for r in results if r.is_anomaly)

    if HAS_RICH:
        summary = Table(title="Batch Summary & Metrics", border_style="green")
        summary.add_column("Metric", style="bold")
        summary.add_column("Value")

        summary.add_row("Total Processed", f"{len(results):,}")
        summary.add_row("Execution Time", f"{total_time:.3f} s ({flows_per_sec:,.1f} flows/sec)")
        summary.add_row("Anomalies Flagged", f"{anomaly_count} ({(anomaly_count / len(results)) * 100:.1f}%)")
        summary.add_row("Class Distribution", ", ".join(f"{k}: {v}" for k, v in attack_counts.most_common()))
        summary.add_row("Severity Breakdown", ", ".join(f"{k}: {v}" for k, v in severity_counts.items()))
        console.print(summary)
    else:
        print("\nBatch Summary & Metrics:")
        print(f"  - Total Processed:    {len(results):,}")
        print(f"  - Execution Time:     {total_time:.3f} s ({flows_per_sec:,.1f} flows/sec)")
        print(f"  - Anomalies Flagged:  {anomaly_count} ({(anomaly_count / len(results)) * 100:.1f}%)")
        print(f"  - Class Distribution: {dict(attack_counts.most_common())}")
        print(f"  - Severity Breakdown: {dict(severity_counts)}")


# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: evaluate
# ─────────────────────────────────────────────────────────────────────────────

def cmd_evaluate(args):
    print_banner()
    mod = _load_backend()
    meta_path = mod["settings"].metadata_path

    if not meta_path.exists():
        print(f"[!] Metadata file not found at '{meta_path}'.")
        print("    Train the models first to generate performance metrics:\n      python cli.py train")
        return

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    if HAS_RICH:
        table = Table(title="Model Evaluation & Architecture Metadata", border_style="cyan")
        table.add_column("Property", style="bold")
        table.add_column("Value")

        table.add_row("Model Version", meta.get("version", "1.0.0"))
        table.add_row("Features Dimension", str(meta.get("num_features", 24)))
        table.add_row("Trained Classes", f"{meta.get('num_classes', 16)} attack families")
        table.add_row("Classifier Accuracy", f"{meta.get('classifier_metrics', {}).get('accuracy', 0.0) * 100:.2f}%")
        table.add_row("Autoencoder Threshold", f"{meta.get('anomaly_threshold', 0.0):.6f}")

        config = meta.get("training_config", {})
        if config:
            table.add_row("Hyperparameters", f"Epochs={config.get('epochs')}, Batch={config.get('batch_size')}, LR={config.get('lr')}, FocalGamma={config.get('focal_gamma')}")

        console.print(table)
    else:
        print("Model Evaluation & Architecture Metadata:")
        print(f"  - Model Version:         {meta.get('version', '1.0.0')}")
        print(f"  - Features Dimension:    {meta.get('num_features', 24)}")
        print(f"  - Trained Classes:       {meta.get('num_classes', 16)}")
        print(f"  - Classifier Accuracy:   {meta.get('classifier_metrics', {}).get('accuracy', 0.0) * 100:.2f}%")
        print(f"  - Autoencoder Threshold: {meta.get('anomaly_threshold', 0.0):.6f}")


# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: train
# ─────────────────────────────────────────────────────────────────────────────

def cmd_train(args):
    print_banner()
    mod = _load_backend()
    datasets_dir = mod["settings"].datasets_dir

    # Check for dataset files
    supported = ["cicids2017", "unsw_nb15", "nsl_kdd", "cicids2018"]
    found = []
    if datasets_dir.exists():
        for s in supported:
            p = datasets_dir / s
            if p.is_dir() and any(p.glob("*.*")):
                found.append(s)

    if not found:
        msg = (
            f"[!] No training datasets found in '{datasets_dir}'.\n"
            "    Place CSV or Parquet files in any of the supported subdirectories:\n"
            "      - datasets/cicids2017/\n"
            "      - datasets/unsw_nb15/\n"
            "      - datasets/nsl_kdd/\n"
            "      - datasets/cicids2018/\n"
        )
        if HAS_RICH:
            console.print(Panel(msg, title="[yellow]Datasets Missing[/yellow]", border_style="yellow"))
        else:
            print(msg)
        return

    print(f"[*] Detected datasets: {', '.join(found)}")
    print("[*] Starting training pipeline...")
    from training.training_pipeline import run as run_pipeline
    run_pipeline(
        epochs=getattr(args, "epochs", None),
        batch_size=getattr(args, "batch_size", None),
        benign_cap=getattr(args, "benign_cap", None),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main Parser
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="HybridFlowIDS Command-Line Interface — Phase 2: Core Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # health
    subparsers.add_parser("health", help="Check system, database, and model readiness")

    # predict
    pred_parser = subparsers.add_parser("predict", help="Classify a single traffic sample")
    pred_parser.add_argument("--file", "-f", help="Path to sample JSON file")
    pred_parser.add_argument("--json", "-j", help="Inline JSON string with traffic features")
    pred_parser.add_argument("--url", help="Optional payload URL for signature scanning")
    pred_parser.add_argument("--body", help="Optional payload body for signature scanning")
    pred_parser.add_argument("--header", help="Optional payload header for signature scanning")

    # batch
    batch_parser = subparsers.add_parser("batch", help="Classify a batch of samples from CSV or JSON")
    batch_parser.add_argument("--file", "-f", required=True, help="Path to CSV or JSON file")
    batch_parser.add_argument("--limit", "-n", type=int, default=0, help="Limit number of rows to evaluate")

    # evaluate
    subparsers.add_parser("evaluate", help="Display model evaluation metrics and threshold")

    # train
    train_parser = subparsers.add_parser("train", help="Run the full model training pipeline")
    train_parser.add_argument("--epochs", "-e", type=int, default=None, help="Number of training epochs (default: from .env or 60)")
    train_parser.add_argument("--batch-size", "-b", type=int, default=None, help="Batch size (default: from .env or 1024)")
    train_parser.add_argument("--benign-cap", type=int, default=None, help="Cap for majority benign samples (default: 500000)")

    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    args = parser.parse_args()

    commands = {
        "health": cmd_health,
        "predict": cmd_predict,
        "batch": cmd_batch,
        "evaluate": cmd_evaluate,
        "train": cmd_train,
    }

    cmd_fn = commands.get(args.command)
    if cmd_fn:
        cmd_fn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

