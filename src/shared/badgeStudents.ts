import type { BadgeConfig, SparkStudent } from "./types";

interface RemoveBadgeStudentInput {
  students: SparkStudent[];
  activeStudentId?: string;
  studentIdToRemove: string;
  badgeConfig?: BadgeConfig;
}

interface RemoveBadgeStudentResult {
  students: SparkStudent[];
  activeStudentId?: string;
  badgeConfig?: BadgeConfig;
}

export function removeBadgeStudent({
  students,
  activeStudentId,
  studentIdToRemove,
  badgeConfig,
}: RemoveBadgeStudentInput): RemoveBadgeStudentResult {
  if (students.length <= 1) {
    return {
      students,
      activeStudentId,
      badgeConfig,
    };
  }

  const nextStudents = students.filter((student) => student.id !== studentIdToRemove);
  const nextActiveStudentId =
    activeStudentId === studentIdToRemove
      ? nextStudents[0]?.id
      : activeStudentId && nextStudents.some((student) => student.id === activeStudentId)
        ? activeStudentId
        : nextStudents[0]?.id;

  const nextBadgeConfig = badgeConfig
    ? {
        ...badgeConfig,
        badgeSprites: (badgeConfig.badgeSprites || []).filter(
          (sprite) => sprite.studentId !== studentIdToRemove,
        ),
      }
    : badgeConfig;

  return {
    students: nextStudents,
    activeStudentId: nextActiveStudentId,
    badgeConfig: nextBadgeConfig,
  };
}
