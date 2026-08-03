"""Automated checks for the sort/search engine in algorithms.py.

Plain if/else checks (no assert/pytest/unittest) — prints one PASS/FAIL
line per case. Run with:

    python check_algorithms.py
"""

from algorithms import binary_search, binary_search_count, insertion_sort, insertion_sort_count, linear_search_count


def check(case_name, result, expected):
    if result == expected:
        print(f"PASS: {case_name}")
    else:
        print(f"FAIL: {case_name} — expected {expected}, got {result}")


def run_checks():
    # 1. insertion_sort on an empty list leaves it empty and completes without error.
    records = []
    insertion_sort(records, key="value")
    check("insertion_sort empty list", records, [])

    # 2. insertion_sort on a single-element list leaves that element unchanged.
    records = [{"value": 5}]
    insertion_sort(records, key="value")
    check("insertion_sort single element", records, [{"value": 5}])

    # 3. binary_search finds first, last, and middle index of a sorted list of
    #    distinct key values.
    sorted_records = [{"value": v} for v in [10, 20, 30, 40, 50]]
    check("binary_search first index", binary_search(sorted_records, 10, key="value"), 0)
    check("binary_search last index", binary_search(sorted_records, 50, key="value"), 4)
    check("binary_search middle index", binary_search(sorted_records, 30, key="value"), 2)

    # 4. binary_search returns the not-found result (-1) when the target is absent.
    check("binary_search absent value", binary_search(sorted_records, 99, key="value"), -1)

    # 5. insertion_sort_count on a small hand-checkable list.
    records = [{"value": 3}, {"value": 1}, {"value": 2}]
    comparisons = insertion_sort_count(records, key="value")
    check("insertion_sort_count sorts correctly", records, [{"value": 1}, {"value": 2}, {"value": 3}])
    is_positive_int = type(comparisons) == int and comparisons > 0
    check("insertion_sort_count returns positive int", is_positive_int, True)

    # 6. binary_search_count on a sorted list for a value present at a known index.
    result = binary_search_count(sorted_records, 30, key="value")
    check("binary_search_count finds known index", result["index"], 2)
    comparison_count_valid = type(result["comparison_count"]) == int and result["comparison_count"] > 0
    check("binary_search_count comparison_count is positive int", comparison_count_valid, True)

    # 7. linear_search_count on a list for an absent value.
    records = [{"value": 1}, {"value": 2}, {"value": 3}]
    result = linear_search_count(records, 99, key="value")
    check("linear_search_count absent index", result["index"], -1)
    check("linear_search_count absent comparison_count", result["comparison_count"], len(records))


if __name__ == "__main__":
    run_checks()
