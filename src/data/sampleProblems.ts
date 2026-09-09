import type { Problem } from "../api/problemApi";

/**
 * 10 dummy Array questions for learning & practice.
 * Seed into DB via Admin → Create Question, or run seedSampleProblems().
 */
export const sampleProblems: Partial<Problem>[] = [
  {
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Hash Table"],
    description:
      "You are given an array of integers `nums` and an integer `target`.\n\nReturn the indices of the two numbers such that they add up to `target`.\n\nExample:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: nums[0] + nums[1] = 2 + 7 = 9",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function twoSum(nums, target) {\n  // return [index1, index2]\n}",
      },
    ],
    testcases: [{ input: "[2,7,11,15]\n9", output: "[0,1]", isHidden: false }],
  },
  {
    title: "Find Maximum Element",
    slug: "find-maximum-element",
    difficulty: "easy",
    category: "Array",
    tags: ["Array"],
    description:
      "Given an array of integers, return the largest number in the array.\n\nExample:\nInput: nums = [3, 1, 4, 1, 5, 9]\nOutput: 9\n\nHint: Loop through the array and keep track of the max value seen so far.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function findMax(nums) {\n  // return the maximum number\n}",
      },
    ],
    testcases: [{ input: "[3,1,4,1,5,9]", output: "9", isHidden: false }],
  },
  {
    title: "Reverse an Array",
    slug: "reverse-an-array",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Two Pointers"],
    description:
      "Given an array, return a new array with elements in reverse order.\n\nExample:\nInput: nums = [1, 2, 3, 4, 5]\nOutput: [5, 4, 3, 2, 1]\n\nHint: You can use two pointers — one at start, one at end — and swap.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function reverseArray(nums) {\n  // return reversed array\n}",
      },
    ],
    testcases: [{ input: "[1,2,3,4,5]", output: "[5,4,3,2,1]", isHidden: false }],
  },
  {
    title: "Sum of Array Elements",
    slug: "sum-of-array-elements",
    difficulty: "easy",
    category: "Array",
    tags: ["Array"],
    description:
      "Given an array of integers, return the sum of all elements.\n\nExample:\nInput: nums = [1, 2, 3, 4]\nOutput: 10\n\nHint: Use a loop and add each element to a running total.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function arraySum(nums) {\n  // return total sum\n}",
      },
    ],
    testcases: [{ input: "[1,2,3,4]", output: "10", isHidden: false }],
  },
  {
    title: "Count Even Numbers",
    slug: "count-even-numbers",
    difficulty: "easy",
    category: "Array",
    tags: ["Array"],
    description:
      "Given an array of integers, count how many numbers are even.\n\nExample:\nInput: nums = [1, 2, 3, 4, 6, 8]\nOutput: 4\n\nHint: A number is even if `num % 2 === 0`.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function countEven(nums) {\n  // return count of even numbers\n}",
      },
    ],
    testcases: [{ input: "[1,2,3,4,6,8]", output: "4", isHidden: false }],
  },
  {
    title: "Contains Duplicate",
    slug: "contains-duplicate",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Hash Table"],
    description:
      "Given an integer array, return `true` if any value appears at least twice, otherwise return `false`.\n\nExample:\nInput: nums = [1, 2, 3, 1]\nOutput: true\n\nInput: nums = [1, 2, 3, 4]\nOutput: false\n\nHint: Use a Set to track numbers you've already seen.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function containsDuplicate(nums) {\n  // return true or false\n}",
      },
    ],
    testcases: [{ input: "[1,2,3,1]", output: "true", isHidden: false }],
  },
  {
    title: "Move Zeroes",
    slug: "move-zeroes",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Two Pointers"],
    description:
      "Given an array, move all `0`s to the end while keeping the order of non-zero elements.\n\nExample:\nInput: nums = [0, 1, 0, 3, 12]\nOutput: [1, 3, 12, 0, 0]\n\nHint: Use two pointers — one to track where the next non-zero should go.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function moveZeroes(nums) {\n  // modify nums in-place, return nums\n}",
      },
    ],
    testcases: [{ input: "[0,1,0,3,12]", output: "[1,3,12,0,0]", isHidden: false }],
  },
  {
    title: "Best Time to Buy and Sell Stock",
    slug: "best-time-to-buy-and-sell-stock",
    difficulty: "easy",
    category: "Array",
    tags: ["Array", "Dynamic Programming"],
    description:
      "You are given an array `prices` where `prices[i]` is the stock price on day `i`.\n\nReturn the maximum profit you can make by buying on one day and selling on a later day. If no profit is possible, return `0`.\n\nExample:\nInput: prices = [7, 1, 5, 3, 6, 4]\nOutput: 5\nExplanation: Buy at 1, sell at 6 → profit = 5\n\nHint: Track the minimum price seen so far.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function maxProfit(prices) {\n  // return max profit\n}",
      },
    ],
    testcases: [{ input: "[7,1,5,3,6,4]", output: "5", isHidden: false }],
  },
  {
    title: "Maximum Subarray Sum",
    slug: "maximum-subarray-sum",
    difficulty: "medium",
    category: "Array",
    tags: ["Array", "Dynamic Programming"],
    description:
      "Given an integer array, find the contiguous subarray with the largest sum and return that sum.\n\nExample:\nInput: nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]\nOutput: 6\nExplanation: Subarray [4, -1, 2, 1] has the largest sum = 6.\n\nHint: This is Kadane's Algorithm — at each step, decide: extend current subarray or start fresh.",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function maxSubArray(nums) {\n  // return largest subarray sum\n}",
      },
    ],
    testcases: [{ input: "[-2,1,-3,4,-1,2,1,-5,4]", output: "6", isHidden: false }],
  },
  {
    title: "Product of Array Except Self",
    slug: "product-of-array-except-self",
    difficulty: "medium",
    category: "Array",
    tags: ["Prefix Sum"],
    description:
      "Given an integer array `nums`, return an array `answer` such that `answer[i]` is the product of all elements except `nums[i]`.\n\nDo not use division.\n\nExample:\nInput: nums = [1, 2, 3, 4]\nOutput: [24, 12, 8, 6]\nExplanation: answer[0] = 2×3×4 = 24, answer[1] = 1×3×4 = 12, etc.\n\nHint: Use prefix products (left to right) and suffix products (right to left).",
    codeStubs: [
      {
        language: "javascript",
        startSnippet: "",
        userTemplate: "function productExceptSelf(nums) {\n  // return product array\n}",
      },
    ],
    testcases: [{ input: "[1,2,3,4]", output: "[24,12,8,6]", isHidden: false }],
  },
];
