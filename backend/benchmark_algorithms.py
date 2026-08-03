"""Comparison-counting benchmark for the sort/search engine behind /tasks.

Runs the Task 5 counting wrappers (algorithms.py) against synthetic task
records shaped exactly like real rows (title, priority, due_date) at three
sizes, so the counts reflect the same engine that powers the live
GET /tasks?sort=... and GET /tasks/search endpoints.

Run with:
    python benchmark_algorithms.py
"""

import os
import random

from algorithms import binary_search_count, insertion_sort, insertion_sort_count, linear_search_count

PRIORITY_RANK = {"low": 1, "medium": 2, "high": 3}
PRIORITIES = ["low", "medium", "high"]

random.seed(42)


def make_synthetic_tasks(n):
    tasks = []
    for i in range(n):
        tasks.append(
            {
                "title": f"Task {i:06d}",
                "priority": random.choice(PRIORITIES),
                "due_date": f"2026-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}",
            }
        )
    return tasks


def benchmark_size(n):
    tasks = make_synthetic_tasks(n)

    # --- sort: mirrors GET /tasks?sort=priority ---
    sort_records = [dict(t, _sort_key=PRIORITY_RANK[t["priority"]]) for t in tasks]
    sort_comparisons = insertion_sort_count(sort_records, key="_sort_key")

    # --- search: mirrors GET /tasks/search (index built in DB fetch order) ---
    index = [{"title": t["title"]} for t in tasks]
    random.shuffle(index)

    sorted_index = [dict(r) for r in index]
    insertion_sort(sorted_index, key="title")  # uncounted, just to get a sorted copy

    present_target = tasks[n // 2]["title"]
    absent_target = "__DOES_NOT_EXIST__"

    binary_present = binary_search_count(sorted_index, present_target, key="title")
    binary_absent = binary_search_count(sorted_index, absent_target, key="title")
    linear_present = linear_search_count(index, present_target, key="title")
    linear_absent = linear_search_count(index, absent_target, key="title")

    return {
        "n": n,
        "sort_comparisons": sort_comparisons,
        "binary_present_comparisons": binary_present["comparison_count"],
        "binary_absent_comparisons": binary_absent["comparison_count"],
        "linear_present_comparisons": linear_present["comparison_count"],
        "linear_absent_comparisons": linear_absent["comparison_count"],
    }


def main():
    sizes = [10, 500, 3000]
    results = [benchmark_size(n) for n in sizes]

    header = (
        f"{'n':>6} | {'insertion_sort':>15} | {'binary (present)':>17} | "
        f"{'binary (absent)':>16} | {'linear (present)':>17} | {'linear (absent)':>16}"
    )
    lines = [header, "-" * len(header)]
    for r in results:
        lines.append(
            f"{r['n']:>6} | {r['sort_comparisons']:>15} | "
            f"{r['binary_present_comparisons']:>17} | {r['binary_absent_comparisons']:>16} | "
            f"{r['linear_present_comparisons']:>17} | {r['linear_absent_comparisons']:>16}"
        )

    output = "\n".join(lines)
    print(output)

    results_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "benchmark_results.txt")
    with open(results_path, "w") as f:
        f.write("TaskFlow algorithm benchmark - comparison counts\n")
        f.write("Data: synthetic task records shaped like real rows (title, priority, due_date)\n\n")
        f.write(output + "\n")

    print(f"\nSaved raw results to {results_path}")


if __name__ == "__main__":
    main()
