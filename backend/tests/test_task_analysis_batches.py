from backend.app.services.chat import task_analysis_batches as batches


def _msg(mid: str) -> dict:
    return {"message_id": mid, "content": "hi", "sender_id": "u1", "created_at": "2026-01-01"}


def test_select_requires_full_batch() -> None:
    all_msgs = [_msg(f"m{i}") for i in range(4)]
    assert batches.select_messages_for_extraction(
        all_msgs,
        last_analyzed_id=None,
        next_batch_index=0,
        force=False,
    ) is None

    all_msgs = [_msg(f"m{i}") for i in range(7)]
    sel = batches.select_messages_for_extraction(
        all_msgs,
        last_analyzed_id=None,
        next_batch_index=0,
        force=False,
    )
    assert sel is not None
    msgs, meta = sel
    assert len(msgs) == 5
    assert meta["first_message_id"] == "m0"
    assert meta["last_message_id"] == "m4"


def test_does_not_reanalyze_completed_section() -> None:
    all_msgs = [_msg(f"m{i}") for i in range(8)]
    sel1 = batches.select_messages_for_extraction(
        all_msgs,
        last_analyzed_id=None,
        next_batch_index=0,
        force=False,
    )
    assert sel1 is not None
    _, meta1 = sel1
    sel2 = batches.select_messages_for_extraction(
        all_msgs,
        last_analyzed_id=meta1["last_message_id"],
        next_batch_index=1,
        force=False,
    )
    assert sel2 is None

    more = [_msg(f"m{i}") for i in range(8, 10)]
    all_msgs = all_msgs + more
    sel2 = batches.select_messages_for_extraction(
        all_msgs,
        last_analyzed_id=meta1["last_message_id"],
        next_batch_index=1,
        force=False,
    )
    assert sel2 is not None
    msgs2, meta2 = sel2
    assert len(msgs2) == 5
    assert meta2["first_message_id"] == "m5"
    assert meta2["last_message_id"] == "m9"
