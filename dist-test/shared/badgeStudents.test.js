"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const badgeStudents_1 = require("./badgeStudents");
function createStudent(id, name) {
    return {
        id,
        name,
        yellowSparks: 0,
        blueSparks: 0,
        pinkSparks: 0,
        stars: 0,
        badgeVisible: true,
        badgeSparkVariant: "gold",
    };
}
(0, node_test_1.default)("removeBadgeStudent removes the student, retargets active selection, and cleans badge sprites", () => {
    const students = [
        createStudent("student-1", "Ada"),
        createStudent("student-2", "Grace"),
        createStudent("student-3", "Linus"),
    ];
    const badgeConfig = {
        congratsText: "Today you generated {n} Sparks",
        showStudentName: true,
        showFinalScore: true,
        alwaysDisplay: false,
        fontSize: 2.2,
        confettiCount: 30,
        celebrationDurationMs: 5000,
        badgeSprites: [
            { id: "sprite-1", studentId: "student-1", x: 10, y: 20, width: 50, height: 60, variant: "gold" },
            { id: "sprite-2", studentId: "student-2", x: 20, y: 30, width: 50, height: 60, variant: "blue" },
            { id: "sprite-3", studentId: "student-2", x: 30, y: 40, width: 50, height: 60, variant: "pink" },
            { id: "sprite-4", studentId: "student-3", x: 40, y: 50, width: 50, height: 60, variant: "gold" },
        ],
    };
    const result = (0, badgeStudents_1.removeBadgeStudent)({
        students,
        activeStudentId: "student-2",
        studentIdToRemove: "student-2",
        badgeConfig,
    });
    strict_1.default.deepEqual(result.students.map((student) => student.id), ["student-1", "student-3"]);
    strict_1.default.equal(result.activeStudentId, "student-1");
    strict_1.default.ok(result.badgeConfig);
    strict_1.default.deepEqual((result.badgeConfig.badgeSprites || []).map((sprite) => sprite.studentId), ["student-1", "student-3"]);
});
(0, node_test_1.default)("removeBadgeStudent keeps current state when asked to remove the last student", () => {
    const students = [createStudent("student-1", "Ada")];
    const badgeConfig = { badgeSprites: [{ id: "sprite-1", studentId: "student-1", x: 0, y: 0, width: 10, height: 10 }] };
    const result = (0, badgeStudents_1.removeBadgeStudent)({
        students,
        activeStudentId: "student-1",
        studentIdToRemove: "student-1",
        badgeConfig,
    });
    strict_1.default.equal(result.students, students);
    strict_1.default.equal(result.activeStudentId, "student-1");
    strict_1.default.equal(result.badgeConfig, badgeConfig);
});
(0, node_test_1.default)("removeBadgeStudent preserves the selected student when removing a different student", () => {
    const students = [
        createStudent("student-1", "Ada"),
        createStudent("student-2", "Grace"),
        createStudent("student-3", "Linus"),
    ];
    const result = (0, badgeStudents_1.removeBadgeStudent)({
        students,
        activeStudentId: "student-2",
        studentIdToRemove: "student-1",
        badgeConfig: { badgeSprites: [] },
    });
    strict_1.default.deepEqual(result.students.map((student) => student.id), ["student-2", "student-3"]);
    strict_1.default.equal(result.activeStudentId, "student-2");
});
