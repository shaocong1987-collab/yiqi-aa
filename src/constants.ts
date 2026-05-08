import type { ActivityType, Category, DefaultSplitMode, ExpenseSplitMode, MemberType } from "./types";

export const activityTypes: Record<ActivityType, string> = {
  meal: "吃饭聚餐",
  camping: "露营短途",
  travel: "多日旅行",
  other: "其他",
};

export const defaultSplitModes: Record<DefaultSplitMode, string> = {
  group: "按家庭 A",
  member: "按人头 A",
  custom: "自定义份数",
  none: "不设置默认",
};

export const expenseSplitModes: Record<ExpenseSplitMode, string> = {
  default: "使用活动默认规则",
  all_members: "大家一起 A",
  selected_members: "只和几个人 A",
  groups: "按家庭 A",
  ignore: "这笔先不 A",
};

export const memberTypes: Record<MemberType, string> = {
  adult: "大人",
  child: "孩子",
  other: "其他",
};

export const categories: Record<Category, string> = {
  meal: "餐饮餐费",
  drink: "酒水饮品",
  food: "食材采购",
  hotel: "住宿费用",
  traffic: "交通出行",
  fuel: "油费高速",
  ticket: "车票机票",
  experience: "特色体验",
  equipment: "装备物资",
  children: "儿童相关",
  medical: "医药应急",
  service: "服务杂费",
  other: "其他费用",
};
