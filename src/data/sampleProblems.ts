import type { Problem } from "../api/problemApi";

/** Curated 5-problem catalog (JS + Python + C++). Prefer DB seed script. */
export const sampleProblems: Partial<Problem>[] = [
  {
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Hash Table", "Two Pointers"],
    description:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.",
    functionName: "twoSum",
    className: "Solution",
    starterCode: {
      javascript: "function twoSum(nums, target) {\n    // return [index1, index2]\n}\n",
      python:
        "class Solution:\n    def twoSum(self, nums, target):\n        # return [index1, index2]\n        pass\n",
      cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // return {index1, index2}\n    }\n};",
    },
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate:
          "function twoSum(nums, target) {\n    // return [index1, index2]\n}\n",
      },
      {
        language: "python",
        startSnippet: "",
        userTemplate:
          "class Solution:\n    def twoSum(self, nums, target):\n        # return [index1, index2]\n        pass\n",
      },
      {
        language: "cpp",
        startSnippet: "",
        userTemplate:
          "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // return {index1, index2}\n    }\n};",
      },
    ],
    testcases: [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        output: "[0,1]",
        expectedOutput: "[0,1]",
        isHidden: false,
      },
    ],
  },
  {
    title: "Maximum Subarray",
    slug: "maximum-subarray",
    difficulty: "medium",
    category: "Array",
    tags: ["Array", "Dynamic Programming", "Kadane"],
    description:
      "Find the contiguous subarray with the largest sum and return its sum.",
    functionName: "maxSubArray",
    className: "Solution",
    starterCode: {
      javascript: "function maxSubArray(nums) {\n    // return largest subarray sum\n}\n",
      python:
        "class Solution:\n    def maxSubArray(self, nums):\n        # return largest subarray sum\n        pass\n",
      cpp: "class Solution {\npublic:\n    int maxSubArray(vector<int>& nums) {\n        // return largest subarray sum\n    }\n};",
    },
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate:
          "function maxSubArray(nums) {\n    // return largest subarray sum\n}\n",
      },
      {
        language: "python",
        startSnippet: "",
        userTemplate:
          "class Solution:\n    def maxSubArray(self, nums):\n        # return largest subarray sum\n        pass\n",
      },
      {
        language: "cpp",
        startSnippet: "",
        userTemplate:
          "class Solution {\npublic:\n    int maxSubArray(vector<int>& nums) {\n        // return largest subarray sum\n    }\n};",
      },
    ],
    testcases: [
      {
        input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] },
        output: "6",
        expectedOutput: "6",
        isHidden: false,
      },
    ],
  },
  {
    title: "Contains Duplicate",
    slug: "contains-duplicate",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Hash Table"],
    description:
      "Return true if any value appears at least twice in the array.",
    functionName: "containsDuplicate",
    className: "Solution",
    starterCode: {
      javascript:
        "function containsDuplicate(nums) {\n    // return true if any value appears twice\n}\n",
      python:
        "class Solution:\n    def containsDuplicate(self, nums):\n        # return True if any value appears twice\n        pass\n",
      cpp: "class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        // return true if any value appears twice\n    }\n};",
    },
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate:
          "function containsDuplicate(nums) {\n    // return true if any value appears twice\n}\n",
      },
      {
        language: "python",
        startSnippet: "",
        userTemplate:
          "class Solution:\n    def containsDuplicate(self, nums):\n        # return True if any value appears twice\n        pass\n",
      },
      {
        language: "cpp",
        startSnippet: "",
        userTemplate:
          "class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        // return true if any value appears twice\n    }\n};",
      },
    ],
    testcases: [
      {
        input: { nums: [1, 2, 3, 1] },
        output: "true",
        expectedOutput: "true",
        isHidden: false,
      },
    ],
  },
  {
    title: "Reverse an Array",
    slug: "reverse-an-array",
    difficulty: "easy",
    category: "Two Pointers",
    tags: ["Array", "Two Pointers"],
    description: "Return a new array with elements in reverse order.",
    functionName: "reverseArray",
    className: "Solution",
    starterCode: {
      javascript: "function reverseArray(nums) {\n    // return reversed array\n}\n",
      python:
        "class Solution:\n    def reverseArray(self, nums):\n        # return reversed array\n        pass\n",
      cpp: "class Solution {\npublic:\n    vector<int> reverseArray(vector<int>& nums) {\n        // return reversed array\n    }\n};",
    },
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate:
          "function reverseArray(nums) {\n    // return reversed array\n}\n",
      },
      {
        language: "python",
        startSnippet: "",
        userTemplate:
          "class Solution:\n    def reverseArray(self, nums):\n        # return reversed array\n        pass\n",
      },
      {
        language: "cpp",
        startSnippet: "",
        userTemplate:
          "class Solution {\npublic:\n    vector<int> reverseArray(vector<int>& nums) {\n        // return reversed array\n    }\n};",
      },
    ],
    testcases: [
      {
        input: { nums: [1, 2, 3, 4, 5] },
        output: "[5,4,3,2,1]",
        expectedOutput: "[5,4,3,2,1]",
        isHidden: false,
      },
    ],
  },
  {
    title: "Find Maximum Element",
    slug: "find-maximum-element",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Basics"],
    description: "Return the largest number in a non-empty integer array.",
    functionName: "findMax",
    className: "Solution",
    starterCode: {
      javascript: "function findMax(nums) {\n    // return the maximum number\n}\n",
      python:
        "class Solution:\n    def findMax(self, nums):\n        # return the maximum number\n        pass\n",
      cpp: "class Solution {\npublic:\n    int findMax(vector<int>& nums) {\n        // return the maximum number\n    }\n};",
    },
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate:
          "function findMax(nums) {\n    // return the maximum number\n}\n",
      },
      {
        language: "python",
        startSnippet: "",
        userTemplate:
          "class Solution:\n    def findMax(self, nums):\n        # return the maximum number\n        pass\n",
      },
      {
        language: "cpp",
        startSnippet: "",
        userTemplate:
          "class Solution {\npublic:\n    int findMax(vector<int>& nums) {\n        // return the maximum number\n    }\n};",
      },
    ],
    testcases: [
      {
        input: { nums: [3, 1, 4, 1, 5, 9] },
        output: "9",
        expectedOutput: "9",
        isHidden: false,
      },
    ],
  },
];
