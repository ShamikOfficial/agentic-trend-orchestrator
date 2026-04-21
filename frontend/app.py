from __future__ import annotations

from datetime import date

import streamlit as st

from backend.app.models.workflow import WorkflowStage
from backend.app.services.team.service import (
    extract_tasks,
    run_deadline_reminders,
    summarize_content,
)
from backend.app.services.workflow.service import (
    STAGES,
    create_milestone,
    create_workflow_item,
    move_stage,
)


def _init_state() -> None:
    if "tasks" not in st.session_state:
        st.session_state.tasks = []
    if "workflow_items" not in st.session_state:
        st.session_state.workflow_items = []
    if "milestones" not in st.session_state:
        st.session_state.milestones = []


def _team_assistant_tab() -> None:
    st.subheader("Team Assistant")
    source_type = st.selectbox("Source Type", ["meeting", "chat"])
    title = st.text_input("Session Title", value="Weekly planning")
    content = st.text_area(
        "Chat/Meeting Content",
        height=220,
        value=(
            "Meeting notes:\n"
            "Action: Shamik prepare trend shortlist tomorrow\n"
            "TODO: Batu finalize storyboard ASAP\n"
            "- Shufen review draft script by Friday\n"
        ),
    )
    owner_candidates_raw = st.text_input(
        "Owner Candidates (comma separated)", value="Shamik, Batu, Shufen"
    )
    default_due_days = st.slider("Default Due Days", min_value=1, max_value=14, value=3)
    window_hours = st.slider("Reminder Window (hours)", min_value=1, max_value=72, value=24)

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Summarize Content", use_container_width=True):
            summary = summarize_content(content, source_type=source_type, title=title)
            st.success("Summary generated")
            st.json(summary.model_dump(mode="json"))
    with col2:
        if st.button("Extract Tasks", use_container_width=True):
            candidates = [x.strip() for x in owner_candidates_raw.split(",") if x.strip()]
            tasks = extract_tasks(content, owner_candidates=candidates, default_due_days=default_due_days)
            st.session_state.tasks = tasks
            st.success(f"Extracted {len(tasks)} tasks")

    st.markdown("### Current Tasks")
    if st.session_state.tasks:
        for task in st.session_state.tasks:
            st.json(task.model_dump(mode="json"))
    else:
        st.info("No tasks extracted yet.")

    if st.button("Run Deadline Reminders", use_container_width=True):
        reminders = run_deadline_reminders(st.session_state.tasks, window_hours=window_hours)
        if reminders:
            st.warning(f"Generated {len(reminders)} reminder(s)")
            for reminder in reminders:
                st.json(reminder.model_dump(mode="json"))
        else:
            st.success("No reminders needed right now.")


def _workflow_tab() -> None:
    st.subheader("Workflow & Milestones")
    with st.expander("Create Workflow Item", expanded=True):
        wf_title = st.text_input("Item Title", value="Budget Mythbuster Short")
        wf_desc = st.text_area("Description", value="Draft and publish one short-form video.")
        wf_owner = st.text_input("Owner", value="Batu")
        linked_trend = st.text_input("Linked Trend", value="budgeting basics")
        if st.button("Create Workflow Item", use_container_width=True):
            item = create_workflow_item(
                title=wf_title, description=wf_desc, owner=wf_owner or None, linked_trend=linked_trend or None
            )
            st.session_state.workflow_items.append(item)
            st.success(f"Created item: {item.item_id}")

    st.markdown("### Workflow Items")
    if not st.session_state.workflow_items:
        st.info("No workflow items yet.")
        return

    item_ids = [item.item_id for item in st.session_state.workflow_items]
    selected_item_id = st.selectbox("Select Item", item_ids)
    selected_item = next(item for item in st.session_state.workflow_items if item.item_id == selected_item_id)
    st.json(selected_item.model_dump(mode="json"))

    st.markdown("### Move Stage")
    current_idx = STAGES.index(selected_item.stage)
    candidate_stages = []
    if current_idx > 0:
        candidate_stages.append(STAGES[current_idx - 1])
    if current_idx < len(STAGES) - 1:
        candidate_stages.append(STAGES[current_idx + 1])

    if candidate_stages:
        to_stage = st.selectbox("Target Stage", candidate_stages)
        move_note = st.text_input("Transition Note", value="Progress update")
        if st.button("Move Stage", use_container_width=True):
            moved = move_stage(selected_item, to_stage=to_stage, note=move_note)
            idx = st.session_state.workflow_items.index(selected_item)
            st.session_state.workflow_items[idx] = moved
            st.success(f"Moved to {moved.stage}")
    else:
        st.info("No further stage transitions available.")

    st.markdown("### Milestones")
    ms_title = st.text_input("Milestone Title", value="Script lock")
    ms_owner = st.text_input("Milestone Owner", value="Shufen")
    ms_due_date = st.date_input("Milestone Due Date", value=date.today())
    ms_criteria_raw = st.text_input("Criteria (comma separated)", value="Hook approved, CTA finalized")
    if st.button("Create Milestone", use_container_width=True):
        criteria = [x.strip() for x in ms_criteria_raw.split(",") if x.strip()]
        milestone = create_milestone(
            item_id=selected_item.item_id,
            title=ms_title,
            owner=ms_owner or None,
            due_date=ms_due_date,
            criteria=criteria,
        )
        st.session_state.milestones.append(milestone)
        st.success(f"Created milestone: {milestone.milestone_id}")

    for milestone in st.session_state.milestones:
        if milestone.item_id == selected_item.item_id:
            st.json(milestone.model_dump(mode="json"))


def main() -> None:
    st.set_page_config(page_title="Module Test UI", layout="wide")
    _init_state()

    st.title("Module Test UI")
    st.caption("Simple functional frontend for Team Assistant and Workflow modules.")

    tab_team, tab_workflow = st.tabs(["Team Assistant", "Workflow & Milestones"])
    with tab_team:
        _team_assistant_tab()
    with tab_workflow:
        _workflow_tab()


if __name__ == "__main__":
    main()
