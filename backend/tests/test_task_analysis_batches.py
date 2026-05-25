from backend.app.services.chat import task_analysis_batches as batches


def test_unanalyzed_skips_prior_batch_message_ids():
    all_messages = [
        {"message_id": "m1", "content": "a"},
        {"message_id": "m2", "content": "b"},
        {"message_id": "m3", "content": "c"},
    ]
    prior = [{"message_ids": ["m1", "m2"]}]
    analyzed = batches.analyzed_message_ids_from_batches(prior)
    unanalyzed = batches.unanalyzed_messages(all_messages, analyzed)
    assert [m["message_id"] for m in unanalyzed] == ["m3"]


def test_select_never_returns_analyzed_messages(monkeypatch):
    monkeypatch.setenv("TASK_EXTRACT_BATCH_SIZE", "1")
    all_messages = [
        {"message_id": "m1", "content": "old"},
        {"message_id": "m2", "content": "new"},
    ]
    prior = [{"message_ids": ["m1"], "batch_index": 0, "first_message_id": "m1", "last_message_id": "m1", "message_count": 1}]
    selected = batches.select_messages_for_extraction(
        all_messages,
        last_analyzed_id="m1",
        next_batch_index=1,
        force=True,
        prior_batches=prior,
    )
    assert selected is not None
    msgs, meta = selected
    assert [m["message_id"] for m in msgs] == ["m2"]
    assert meta["message_ids"] == ["m2"]


def test_select_waits_for_full_batch_by_default():
    all_messages = [{"message_id": f"m{i}", "content": str(i)} for i in range(4)]
    selected = batches.select_messages_for_extraction(
        all_messages,
        last_analyzed_id=None,
        next_batch_index=0,
        force=False,
        prior_batches=[],
    )
    assert selected is None
    selected_five = batches.select_messages_for_extraction(
        all_messages + [{"message_id": "m4", "content": "4"}],
        last_analyzed_id=None,
        next_batch_index=0,
        force=False,
        prior_batches=[],
    )
    assert selected_five is not None
    msgs, meta = selected_five
    assert len(msgs) == 5
    assert meta["message_count"] == 5
