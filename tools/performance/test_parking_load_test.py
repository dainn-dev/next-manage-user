from parking_load_test import evaluate, percentile


def test_percentile_uses_nearest_rank():
    assert percentile([4, 1, 3, 2], .50) == 2
    assert percentile([4, 1, 3, 2], .95) == 4


def test_evaluation_requires_latency_throughput_error_and_no_loss():
    results = [{"eventId": "a", "status": 202, "latencyMs": 100},
               {"eventId": "b", "status": 202, "latencyMs": 200}]
    observed = evaluate(results, 1, 2, {
        "p95LatencyMs": 250, "maxErrorRate": 0, "minThroughputPerSecond": 2})
    assert observed["sloMet"] is True
    assert all(observed["checks"].values())


def test_unexplained_loss_fails_gate():
    observed = evaluate([{"eventId": "a", "status": 202, "latencyMs": 10}], 1, 2, {
        "p95LatencyMs": 250, "maxErrorRate": 0, "minThroughputPerSecond": 1})
    assert observed["checks"]["noUnexplainedLoss"] is False
    assert observed["sloMet"] is False
