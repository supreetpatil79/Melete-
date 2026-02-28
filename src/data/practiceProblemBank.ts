export type PracticeProblemDifficulty = "Easy" | "Medium" | "Hard";

export interface PracticeProblemCase {
  input: string;
  expected: string;
  explanation?: string;
}

export interface PracticeBankProblem {
  id: string;
  title: string;
  description: string;
  difficulty: PracticeProblemDifficulty;
  language: "javascript";
  tags: string[];
  topicId?: string;
  template: string;
  testCases: PracticeProblemCase[];
  source: "melete";
}

const javascriptTemplate = (signature: string, bodyHint: string): string => `function ${signature} {
  ${bodyHint}
}

function solve(rawInput) {
  const input = JSON.parse(rawInput);
  const output = ${signature.split("(")[0]}(...Object.values(input));
  return output;
}

const fs = require("fs");
const rawInput = fs.readFileSync(0, "utf8").trim();
const output = solve(rawInput);
process.stdout.write(typeof output === "string" ? output : JSON.stringify(output));`;

export const practiceProblemBank: PracticeBankProblem[] = [
  {
    id: "lc-two-sum",
    title: "Two Sum",
    description:
      "Find indices of two numbers in an array that add up to the target. Return indices in ascending order.",
    difficulty: "Easy",
    language: "javascript",
    tags: ["array", "hashmap", "two-pointers"],
    topicId: "dsa",
    template: javascriptTemplate("twoSum(nums, target)", "// Return an array with the two indices."),
    testCases: [
      { input: "{\"nums\":[2,7,11,15],\"target\":9}", expected: "[0,1]" },
      { input: "{\"nums\":[3,2,4],\"target\":6}", expected: "[1,2]" },
      { input: "{\"nums\":[3,3],\"target\":6}", expected: "[0,1]" },
    ],
    source: "melete",
  },
  {
    id: "lc-valid-parentheses",
    title: "Valid Parentheses",
    description:
      "Given a string containing parentheses/brackets/braces, determine if every opening symbol has a correct closing symbol in order.",
    difficulty: "Easy",
    language: "javascript",
    tags: ["stack", "string"],
    topicId: "dsa",
    template: javascriptTemplate("isValid(s)", "// Return true if the sequence is valid, else false."),
    testCases: [
      { input: "{\"s\":\"()[]{}\"}", expected: "true" },
      { input: "{\"s\":\"(]\"}", expected: "false" },
      { input: "{\"s\":\"({[]})\"}", expected: "true" },
    ],
    source: "melete",
  },
  {
    id: "lc-max-subarray",
    title: "Maximum Subarray",
    description:
      "Return the largest possible sum of a contiguous non-empty subarray using a linear-time approach.",
    difficulty: "Easy",
    language: "javascript",
    tags: ["dynamic-programming", "array", "kadane"],
    topicId: "dsa",
    template: javascriptTemplate("maxSubArray(nums)", "// Return the maximum subarray sum."),
    testCases: [
      { input: "{\"nums\":[-2,1,-3,4,-1,2,1,-5,4]}", expected: "6" },
      { input: "{\"nums\":[1]}", expected: "1" },
      { input: "{\"nums\":[5,4,-1,7,8]}", expected: "23" },
    ],
    source: "melete",
  },
  {
    id: "lc-longest-substring-no-repeat",
    title: "Longest Substring Without Repeating Characters",
    description:
      "Find the length of the longest substring with all unique characters using a sliding window.",
    difficulty: "Medium",
    language: "javascript",
    tags: ["sliding-window", "string", "hashmap"],
    topicId: "dsa",
    template: javascriptTemplate("lengthOfLongestSubstring(s)", "// Return an integer length."),
    testCases: [
      { input: "{\"s\":\"abcabcbb\"}", expected: "3" },
      { input: "{\"s\":\"bbbbb\"}", expected: "1" },
      { input: "{\"s\":\"pwwkew\"}", expected: "3" },
    ],
    source: "melete",
  },
  {
    id: "lc-product-of-array-except-self",
    title: "Product of Array Except Self",
    description:
      "Return an array where each position contains product of all elements except itself, without using division.",
    difficulty: "Medium",
    language: "javascript",
    tags: ["array", "prefix-suffix", "math"],
    topicId: "dsa",
    template: javascriptTemplate("productExceptSelf(nums)", "// Return an array of products."),
    testCases: [
      { input: "{\"nums\":[1,2,3,4]}", expected: "[24,12,8,6]" },
      { input: "{\"nums\":[-1,1,0,-3,3]}", expected: "[0,0,9,0,0]" },
    ],
    source: "melete",
  },
  {
    id: "lc-coin-change",
    title: "Coin Change",
    description:
      "Given coin denominations and a total amount, return minimum coins needed or -1 if impossible.",
    difficulty: "Medium",
    language: "javascript",
    tags: ["dynamic-programming", "array"],
    topicId: "dsa",
    template: javascriptTemplate("coinChange(coins, amount)", "// Return minimum number of coins or -1."),
    testCases: [
      { input: "{\"coins\":[1,2,5],\"amount\":11}", expected: "3" },
      { input: "{\"coins\":[2],\"amount\":3}", expected: "-1" },
      { input: "{\"coins\":[1],\"amount\":0}", expected: "0" },
    ],
    source: "melete",
  },
  {
    id: "lc-number-of-islands",
    title: "Number of Islands",
    description:
      "Count how many islands are present in a 2D grid where '1' is land and '0' is water.",
    difficulty: "Medium",
    language: "javascript",
    tags: ["graph", "dfs", "bfs", "matrix"],
    topicId: "dsa",
    template: javascriptTemplate("numIslands(grid)", "// Return total island count."),
    testCases: [
      {
        input:
          "{\"grid\":[[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]}",
        expected: "1",
      },
      {
        input:
          "{\"grid\":[[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]}",
        expected: "3",
      },
    ],
    source: "melete",
  },
  {
    id: "lc-merge-intervals",
    title: "Merge Intervals",
    description:
      "Merge all overlapping intervals and return a list of disjoint intervals in sorted order.",
    difficulty: "Medium",
    language: "javascript",
    tags: ["array", "sorting", "intervals"],
    topicId: "dsa",
    template: javascriptTemplate("merge(intervals)", "// Return merged intervals."),
    testCases: [
      { input: "{\"intervals\":[[1,3],[2,6],[8,10],[15,18]]}", expected: "[[1,6],[8,10],[15,18]]" },
      { input: "{\"intervals\":[[1,4],[4,5]]}", expected: "[[1,5]]" },
    ],
    source: "melete",
  },
  {
    id: "lc-trapping-rain-water",
    title: "Trapping Rain Water",
    description:
      "Given elevation heights, compute how much water can be trapped after raining.",
    difficulty: "Hard",
    language: "javascript",
    tags: ["two-pointers", "stack", "array"],
    topicId: "dsa",
    template: javascriptTemplate("trap(height)", "// Return trapped water units."),
    testCases: [
      { input: "{\"height\":[0,1,0,2,1,0,1,3,2,1,2,1]}", expected: "6" },
      { input: "{\"height\":[4,2,0,3,2,5]}", expected: "9" },
    ],
    source: "melete",
  },
  {
    id: "lc-minimum-window-substring",
    title: "Minimum Window Substring",
    description:
      "Find the smallest substring of `s` containing all characters of `t` with frequency.",
    difficulty: "Hard",
    language: "javascript",
    tags: ["sliding-window", "string", "hashmap"],
    topicId: "dsa",
    template: javascriptTemplate("minWindow(s, t)", "// Return the minimum covering window as string."),
    testCases: [
      { input: "{\"s\":\"ADOBECODEBANC\",\"t\":\"ABC\"}", expected: "BANC" },
      { input: "{\"s\":\"a\",\"t\":\"a\"}", expected: "a" },
      { input: "{\"s\":\"a\",\"t\":\"aa\"}", expected: "" },
    ],
    source: "melete",
  },
  {
    id: "lc-median-two-sorted-arrays",
    title: "Median of Two Sorted Arrays",
    description:
      "Compute the median of two sorted arrays with overall logarithmic complexity target.",
    difficulty: "Hard",
    language: "javascript",
    tags: ["binary-search", "array", "divide-and-conquer"],
    topicId: "dsa",
    template: javascriptTemplate("findMedianSortedArrays(nums1, nums2)", "// Return median as number."),
    testCases: [
      { input: "{\"nums1\":[1,3],\"nums2\":[2]}", expected: "2" },
      { input: "{\"nums1\":[1,2],\"nums2\":[3,4]}", expected: "2.5" },
      { input: "{\"nums1\":[0,0],\"nums2\":[0,0]}", expected: "0" },
    ],
    source: "melete",
  },
];

