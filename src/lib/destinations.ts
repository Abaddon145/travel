export const destinationSuggestions = [
  "京都",
  "杭州",
  "东京",
  "大阪",
  "奈良",
  "北京",
  "上海",
  "成都",
  "西安",
  "厦门",
  "大理",
  "青岛",
  "香港",
  "台北",
  "首尔",
  "新加坡",
  "巴黎",
  "清迈",
];

export const interestTags = ["美食", "寺庙", "散步", "博物馆", "自然", "购物", "咖啡", "夜景"];

export function suggestDestinations(query: string) {
  const text = query.trim();
  return destinationSuggestions
    .filter((name) => (text ? name.includes(text) && name !== text : true))
    .slice(0, 6);
}
