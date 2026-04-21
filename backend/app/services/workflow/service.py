"""Service placeholders for workflow and milestones module."""


def can_transition(from_stage: str, to_stage: str) -> bool:
    allowed = {
        "Idea": {"Brief"},
        "Brief": {"Production"},
        "Production": {"Review"},
        "Review": {"Publish"},
        "Publish": set(),
    }
    return to_stage in allowed.get(from_stage, set())
