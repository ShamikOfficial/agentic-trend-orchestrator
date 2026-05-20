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


def test_select_never_returns_analyzed_messages():
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
