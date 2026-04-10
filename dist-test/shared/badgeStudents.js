"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeBadgeStudent = removeBadgeStudent;
function removeBadgeStudent({ students, activeStudentId, studentIdToRemove, badgeConfig, }) {
    if (students.length <= 1) {
        return {
            students,
            activeStudentId,
            badgeConfig,
        };
    }
    const nextStudents = students.filter((student) => student.id !== studentIdToRemove);
    const nextActiveStudentId = activeStudentId === studentIdToRemove
        ? nextStudents[0]?.id
        : activeStudentId && nextStudents.some((student) => student.id === activeStudentId)
            ? activeStudentId
            : nextStudents[0]?.id;
    const nextBadgeConfig = badgeConfig
        ? {
            ...badgeConfig,
            badgeSprites: (badgeConfig.badgeSprites || []).filter((sprite) => sprite.studentId !== studentIdToRemove),
        }
        : badgeConfig;
    return {
        students: nextStudents,
        activeStudentId: nextActiveStudentId,
        badgeConfig: nextBadgeConfig,
    };
}
