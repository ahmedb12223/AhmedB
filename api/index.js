// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

// src/utils/arabicFuzzy.ts
function normalizeText2(text) {
  if (!text) return "";
  let normalized = text.trim().toLowerCase();
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, "");
  normalized = normalized.replace(/\u0640/g, "");
  normalized = normalized.replace(/[أإآٱ]/g, "\u0627");
  normalized = normalized.replace(/ة/g, "\u0647");
  normalized = normalized.replace(/[ىئ]/g, "\u064A");
  normalized = normalized.replace(/ؤ/g, "\u0648");
  normalized = normalized.replace(/[^\w\s\u0600-\u06FF]/gi, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}
function normalizeArabicCompounds(text) {
  if (!text) return "";
  let res = normalizeText2(text);
  res = res.replace(/\bعبد\s+([ا-ي])/g, "\u0639\u0628\u062F$1");
  res = res.replace(/\b(ابو|ام)\s+([ا-ي])/g, "$1$2");
  res = res.replace(/\b(سيف|نور|شمس|علاء|بهاء|حسام|ضياء|تقي|محي|محيي|جلال|عماد|صلاح|جمال|بدر|شرف|نجم)\s+الدين\b/g, "$1\u0627\u0644\u062F\u064A\u0646");
  res = res.replace(/\b(هبه|فتح|عطا|فضل|نصر|كرم|رحمة|رحمه|منة|منه)\s+الله\b/g, "$1\u0627\u0644\u0644\u0647");
  return res.replace(/\s+/g, " ").trim();
}
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const matrix = [];
  for (let i = 0; i <= m; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        // deletion
        matrix[i][j - 1] + 1,
        // insertion
        matrix[i - 1][j - 1] + cost
        // substitution
      );
    }
  }
  return matrix[m][n];
}
function calculateSimilarity(query, target) {
  const normQuery = normalizeText2(query);
  const normTarget = normalizeText2(target);
  if (!normQuery || !normTarget) return 0;
  if (normQuery === normTarget) return 1;
  const compQuery = normalizeArabicCompounds(query);
  const compTarget = normalizeArabicCompounds(target);
  if (compQuery === compTarget) return 0.99;
  if (normTarget.includes(normQuery)) {
    return Math.min(0.96, 0.75 + normQuery.length / normTarget.length * 0.25);
  }
  if (normQuery.includes(normTarget)) {
    return Math.min(0.92, 0.7 + normTarget.length / normQuery.length * 0.25);
  }
  const queryTokens = normQuery.split(" ").filter(Boolean);
  const targetTokens = normTarget.split(" ").filter(Boolean);
  let matchedTokens = 0;
  for (const qToken of queryTokens) {
    for (const tToken of targetTokens) {
      if (qToken === tToken) {
        matchedTokens++;
        break;
      } else if (qToken.length > 2 && tToken.length > 2 && (tToken.startsWith(qToken) || qToken.startsWith(tToken) || levenshteinDistance(qToken, tToken) <= 1)) {
        matchedTokens += 0.85;
        break;
      }
    }
  }
  if (targetTokens.length > 0) {
    const tokenScore = matchedTokens / Math.max(queryTokens.length, targetTokens.length);
    if (tokenScore > 0.5) {
      return tokenScore;
    }
  }
  const maxLen = Math.max(normQuery.length, normTarget.length);
  const distance = levenshteinDistance(normQuery, normTarget);
  const levScore = Math.max(0, (maxLen - distance) / maxLen);
  return levScore;
}
function findBestMatch(query, candidates, threshold = 0.65) {
  if (!query || candidates.length === 0) return null;
  let bestMatch = null;
  let highestScore = 0;
  for (const candidate of candidates) {
    const score = calculateSimilarity(query, candidate.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }
  if (bestMatch && highestScore >= threshold) {
    return {
      item: bestMatch,
      score: highestScore,
      isExact: highestScore >= 0.95
    };
  }
  return null;
}

// src/utils/storage.ts
var AHMED_BADAWI_OFFICIAL_SCHEDULE = [
  // Sunday
  { id: "badawi_sun_1", dayOfWeek: "sunday", dayNameArabic: "\u0627\u0644\u0623\u062D\u062F", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0639\u0631\u0628\u064A (4B)", classId: "class_gr4___b", startTime: "08:00", endTime: "08:40", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_sun_2", dayOfWeek: "sunday", dayNameArabic: "\u0627\u0644\u0623\u062D\u062F", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u063A\u0627\u062A (4A)", classId: "class_gr4___a", startTime: "08:40", endTime: "09:20", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_sun_3", dayOfWeek: "sunday", dayNameArabic: "\u0627\u0644\u0623\u062D\u062F", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (7A)", classId: "class_gr7___a", startTime: "09:20", endTime: "10:00", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_sun_4", dayOfWeek: "sunday", dayNameArabic: "\u0627\u0644\u0623\u062D\u062F", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 (5A)", classId: "class_gr5___a", startTime: "10:00", endTime: "10:45", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_sun_5", dayOfWeek: "sunday", dayNameArabic: "\u0627\u0644\u0623\u062D\u062F", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 (6A)", classId: "class_gr6___a", startTime: "10:45", endTime: "11:25", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_sun_6", dayOfWeek: "sunday", dayNameArabic: "\u0627\u0644\u0623\u062D\u062F", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (8A)", classId: "class_gr8___a", startTime: "11:25", endTime: "12:05", subject: "Math", targetTrack: "arabic", zoomUrl: "" },
  // Monday
  { id: "badawi_mon_1", dayOfWeek: "monday", dayNameArabic: "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (7A)", classId: "class_gr7___a", startTime: "08:00", endTime: "08:40", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_mon_2", dayOfWeek: "monday", dayNameArabic: "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 (6A)", classId: "class_gr6___a", startTime: "08:40", endTime: "09:20", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_mon_3", dayOfWeek: "monday", dayNameArabic: "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 (5A)", classId: "class_gr5___a", startTime: "09:20", endTime: "10:00", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_mon_4", dayOfWeek: "monday", dayNameArabic: "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (8A)", classId: "class_gr8___a", startTime: "10:00", endTime: "10:45", subject: "Math", targetTrack: "arabic", zoomUrl: "" },
  { id: "badawi_mon_5", dayOfWeek: "monday", dayNameArabic: "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0639\u0631\u0628\u064A (4B)", classId: "class_gr4___b", startTime: "10:45", endTime: "11:25", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_mon_6", dayOfWeek: "monday", dayNameArabic: "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u063A\u0627\u062A (4A)", classId: "class_gr4___a", startTime: "12:05", endTime: "12:45", subject: "Math", targetTrack: "all", zoomUrl: "" },
  // Tuesday
  { id: "badawi_tue_1", dayOfWeek: "tuesday", dayNameArabic: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u063A\u0627\u062A (4A)", classId: "class_gr4___a", startTime: "08:40", endTime: "09:20", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_tue_2", dayOfWeek: "tuesday", dayNameArabic: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 (5A)", classId: "class_gr5___a", startTime: "09:20", endTime: "10:00", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_tue_3", dayOfWeek: "tuesday", dayNameArabic: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 (6A)", classId: "class_gr6___a", startTime: "10:00", endTime: "10:45", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_tue_4", dayOfWeek: "tuesday", dayNameArabic: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0639\u0631\u0628\u064A (4B)", classId: "class_gr4___b", startTime: "10:45", endTime: "11:25", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_tue_5", dayOfWeek: "tuesday", dayNameArabic: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (7A)", classId: "class_gr7___a", startTime: "11:25", endTime: "12:05", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_tue_6", dayOfWeek: "tuesday", dayNameArabic: "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (8A)", classId: "class_gr8___a", startTime: "12:05", endTime: "12:45", subject: "Math", targetTrack: "arabic", zoomUrl: "" },
  // Wednesday
  { id: "badawi_wed_1", dayOfWeek: "wednesday", dayNameArabic: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0639\u0631\u0628\u064A (4B)", classId: "class_gr4___b", startTime: "08:00", endTime: "08:40", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_wed_2", dayOfWeek: "wednesday", dayNameArabic: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u063A\u0627\u062A (4A)", classId: "class_gr4___a", startTime: "08:40", endTime: "09:20", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_wed_3", dayOfWeek: "wednesday", dayNameArabic: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (7A)", classId: "class_gr7___a", startTime: "09:20", endTime: "10:00", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_wed_4", dayOfWeek: "wednesday", dayNameArabic: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 (6A)", classId: "class_gr6___a", startTime: "10:00", endTime: "10:45", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_wed_5", dayOfWeek: "wednesday", dayNameArabic: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (8A)", classId: "class_gr8___a", startTime: "10:45", endTime: "11:25", subject: "Math", targetTrack: "arabic", zoomUrl: "" },
  { id: "badawi_wed_6", dayOfWeek: "wednesday", dayNameArabic: "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 (5A)", classId: "class_gr5___a", startTime: "11:25", endTime: "12:05", subject: "Math", targetTrack: "english", zoomUrl: "" },
  // Thursday
  { id: "badawi_thu_1", dayOfWeek: "thursday", dayNameArabic: "\u0627\u0644\u062E\u0645\u064A\u0633", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (8A)", classId: "class_gr8___a", startTime: "08:40", endTime: "09:20", subject: "Math", targetTrack: "arabic", zoomUrl: "" },
  { id: "badawi_thu_2", dayOfWeek: "thursday", dayNameArabic: "\u0627\u0644\u062E\u0645\u064A\u0633", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A (7A)", classId: "class_gr7___a", startTime: "09:20", endTime: "10:00", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_thu_3", dayOfWeek: "thursday", dayNameArabic: "\u0627\u0644\u062E\u0645\u064A\u0633", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0639\u0631\u0628\u064A (4B)", classId: "class_gr4___b", startTime: "10:00", endTime: "10:45", subject: "Math", targetTrack: "all", zoomUrl: "" },
  { id: "badawi_thu_4", dayOfWeek: "thursday", dayNameArabic: "\u0627\u0644\u062E\u0645\u064A\u0633", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 (5A)", classId: "class_gr5___a", startTime: "10:45", endTime: "11:25", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_thu_5", dayOfWeek: "thursday", dayNameArabic: "\u0627\u0644\u062E\u0645\u064A\u0633", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 (6A)", classId: "class_gr6___a", startTime: "11:25", endTime: "12:05", subject: "Math", targetTrack: "english", zoomUrl: "" },
  { id: "badawi_thu_6", dayOfWeek: "thursday", dayNameArabic: "\u0627\u0644\u062E\u0645\u064A\u0633", className: "\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u063A\u0627\u062A (4A)", classId: "class_gr4___a", startTime: "12:05", endTime: "12:45", subject: "Math", targetTrack: "all", zoomUrl: "" }
];
var OFFICIAL_ARABIC_STUDENT_NAMES = [
  "\u062A\u064A\u0645 \u0627\u0644\u0644\u0647 \u0635\u0647\u064A\u0628 \u0627\u0628\u0648\u0627\u0644\u0643\u0627\u0645\u0644 \u0639\u0644\u064A",
  "\u0645\u062D\u0645\u062F \u0648\u0627\u0626\u0644 \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u062D\u0645\u062F",
  "\u0645\u062D\u0645\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u064A\u0633\u0649 \u0634\u0631\u064A\u062F\u0645",
  "\u0639\u0645\u0631 \u0639\u0644\u0649 \u0623\u062D\u0645\u062F \u064A\u0648\u0633\u0641 \u0631\u062C\u0628",
  "\u064A\u0627\u0633\u064A\u0646 \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0645\u0635\u0637\u0641\u0649",
  "\u064A\u0627\u0633\u064A\u0646 \u0627\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 \u062D\u0644\u064A\u0645\u0647",
  "\u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0627\u062D\u0645\u062F \u0639\u0644\u064A",
  "\u0645\u0631\u0648\u0627\u0646 \u062E\u0627\u0644\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632",
  "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0633\u0627\u0645\u062D \u0639\u0628\u062F\u0627\u0644\u0645\u0631\u0636\u064A",
  "\u0627\u062F\u0645 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645",
  "\u0627\u064A\u0627\u062F \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u064A\u0633\u0649 \u0643\u0645\u0627\u0644 \u0634\u0631\u064A\u062F\u0645",
  "\u0639\u0627\u062F\u0644 \u0639\u0644\u064A \u0639\u0627\u062F\u0644 \u0639\u0644\u064A \u0627\u062D\u0645\u062F",
  "\u0632\u064A\u0627\u062F \u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645",
  "\u062A\u0645\u064A\u0645 \u0635\u0647\u064A\u0628 \u0627\u0628\u0648 \u0627\u0644\u0645\u0643\u0627\u0631\u0645 \u0639\u0644\u064A",
  "\u0645\u0635\u0637\u0641\u0649 \u0627\u0634\u0631\u0641 \u0635\u0644\u0627\u062D \u0627\u0644\u0633\u0642\u0627",
  "\u064A\u0627\u0633\u064A\u0646 \u0639\u0645\u0631\u0648 \u0632\u0643\u0631\u064A\u0627 \u063A\u0627\u0632\u064A",
  "\u0639\u0645\u0631 \u0627\u0644\u0633\u064A\u062F \u0627\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645"
];
var NORMALIZED_ARABIC_NAMES = new Set(
  OFFICIAL_ARABIC_STUDENT_NAMES.map((name) => normalizeText2(name))
);
function enforceOfficialStudentTracks(studentsList) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) {
    return DEFAULT_STUDENTS;
  }
  return studentsList.filter((st) => st && typeof st === "object" && typeof st.name === "string" && st.name.trim().length > 0).map((st) => {
    const cleanName = st.name.trim();
    const norm = normalizeText2(cleanName);
    const isArabic = NORMALIZED_ARABIC_NAMES.has(norm);
    return {
      ...st,
      name: cleanName,
      track: isArabic ? "arabic" : "english"
    };
  });
}
var DEFAULT_TEACHERS = [
  {
    id: "teacher_ahmed_badawi",
    name: "\u0645\u0633\u062A\u0631 \u0627\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    subject: "\u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0627\u062A (Math)",
    schoolName: "\u0645\u062F\u0631\u0633\u0629 \u0627\u0644\u0644\u063A\u0627\u062A \u0627\u0644\u062D\u062F\u064A\u062B\u0629",
    email: "ahmedbadawi5090@gmail.com",
    defaultZoomLink: "",
    assignedClassIds: ["class_gr4___a", "class_gr4___b", "class_gr5___a", "class_gr6___a", "class_gr7___a", "class_gr8___a"],
    weeklySchedule: AHMED_BADAWI_OFFICIAL_SCHEDULE
  }
];
var DEFAULT_CLASSES = [
  { id: "class_gr4___a", name: "GR4 A", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.548Z" },
  { id: "class_gr4___b", name: "GR4 B", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" },
  { id: "class_gr5___a", name: "GR5 A", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" },
  { id: "class_gr6___a", name: "GR6 A", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" },
  { id: "class_gr7___a", name: "GR7 A", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" },
  { id: "class_gr7___b", name: "GR7 B", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" },
  { id: "class_gr8___a", name: "GR8 A", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" },
  { id: "class_gr9___a", name: "GR9 A", gradeLevel: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629", zoomUrl: "", createdAt: "2026-10-21T15:22:40.549Z" }
];
var DEFAULT_STUDENTS = [
  // GR 4A
  { id: "st_4a_1", name: "\u0627\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u062D\u0644\u064A\u0645\u0647", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-001" },
  { id: "st_4a_2", name: "\u0627\u062D\u0645\u062F \u062D\u0633\u0627\u0645 \u0627\u0644\u062F\u064A\u0646 \u0639\u0628\u062F \u0627\u0644\u0645\u0639\u0632 \u0639\u0628\u062F", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-002" },
  { id: "st_4a_3", name: "\u0627\u064A\u0627\u062F \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0644\u0645 \u0627\u0644\u062F\u064A\u0646", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-003" },
  { id: "st_4a_4", name: "\u0627\u064A\u0627\u062F \u0639\u0644\u0649 \u0643\u0627\u0645\u0644 \u0639\u0628\u062F \u0627\u0644\u0644\u0647", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-004" },
  { id: "st_4a_5", name: "\u0628\u0644\u0627\u0644 \u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0648\u0647\u0627\u0628 \u0647\u062C\u0631\u0633", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-005" },
  { id: "st_4a_6", name: "\u0633\u0644\u064A\u0645 \u064A\u0648\u0633\u0641 \u0639\u0628\u062F \u0627\u0644\u062D\u0645\u064A\u062F \u0637\u0646\u0637\u0627\u0648\u0649", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-006" },
  { id: "st_4a_7", name: "\u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0639\u0645\u0631\u0648 \u0645\u062D\u0645\u062F \u0639\u064A\u0633\u0649", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-007" },
  { id: "st_4a_8", name: "\u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0645\u062D\u0645\u062F \u0641\u062A\u062D\u0649 \u0639\u0628\u062F \u0627\u0644\u062D\u0644\u064A\u0645", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-008" },
  { id: "st_4a_9", name: "\u0639\u0645\u0631 \u0639\u0627\u0645\u0631 \u0645\u062C\u062F\u0649 \u0627\u0644\u0634\u0631\u0628\u064A\u0646\u064A", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-009" },
  { id: "st_4a_10", name: "\u0645\u0627\u0644\u0643 \u0645\u0631\u0648\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u0641\u062A\u0627\u062D \u0639\u0628\u062F \u0627\u0644\u0643\u0631\u064A\u0645", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-010" },
  { id: "st_4a_11", name: "\u064A\u0627\u0633\u064A\u0646 \u0635\u0644\u0627\u062D \u0627\u0644\u062F\u064A\u0646 \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u062F", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-011" },
  { id: "st_4a_12", name: "\u064A\u0627\u0633\u064A\u0646 \u0627\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0639\u0632\u064A\u0632 \u062C\u0627\u0628 \u0627\u0644\u0644\u0647", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-012" },
  { id: "st_4a_13", name: "\u064A\u0632\u064A\u062F \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0644\u0645 \u0627\u0644\u062F\u064A\u0646", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-013" },
  { id: "st_4a_14", name: "\u064A\u0648\u0633\u0641 \u064A\u0648\u0646\u0633 \u0635\u0644\u0627\u062D \u0627\u0644\u0631\u0648\u0628\u064A", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-014" },
  { id: "st_4a_15", name: "\u064A\u0648\u0646\u0633 \u062D\u0633\u0627\u0645 \u0635\u0644\u0627\u062D \u0627\u0644\u062F\u064A\u0646 \u0646\u064A\u0627\u0632\u0649", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-015" },
  { id: "st_4a_16", name: "\u064A\u0648\u0646\u0633 \u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u062D\u0644\u064A\u0645 \u0646\u0635\u0627\u0631", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-016" },
  { id: "st_4a_17", name: "\u0633\u0644\u064A\u0645 \u0627\u062D\u0645\u062F \u0645\u0635\u0637\u0641\u0649 \u0627\u0628\u0631\u0627\u0647\u064A\u0645", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-017" },
  { id: "st_4a_18", name: "\u0645\u0627\u0644\u0643 \u0645\u0635\u0637\u0641\u0649 \u0645\u062D\u0645\u062F \u062F\u0647\u0628", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-018" },
  { id: "st_4a_19", name: "\u0645\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0627\u0644\u0635\u0627\u0648\u0649 \u0645\u062D\u0645\u062F", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-019" },
  { id: "st_4a_20", name: "\u0633\u0644\u064A\u0645 \u0627\u0633\u0627\u0644\u0645 \u0645\u062D\u0645\u062F", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-020" },
  { id: "st_4a_21", name: "\u0623\u062F\u0645 \u0639\u0644\u0627\u0621 \u0627\u0644\u062F\u064A\u0646 \u0634\u062A\u0627", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-021" },
  { id: "st_4a_22", name: "\u0632\u064A\u0627\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0648\u0647\u0627\u0628 \u0627\u0644\u0639\u0648\u0636\u0649", classId: "class_gr4___a", track: "english", studentCode: "GR4-A-022" },
  // GR 4B
  { id: "st_4b_1", name: "\u064A\u0648\u0633\u0641 \u0645\u062D\u0645\u062F \u0635\u0628\u062D\u064A \u0634\u062D\u0627\u062A\u0647", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-001" },
  { id: "st_4b_2", name: "\u0633\u064A\u0641 \u0627\u0644\u062F\u064A\u0646 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-002" },
  { id: "st_4b_3", name: "\u062D\u0627\u0632\u0645 \u0639\u0645\u0627\u062F \u0633\u0645\u064A\u0631 \u0627\u0644\u0635\u0639\u064A\u062F\u064A", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-003" },
  { id: "st_4b_4", name: "\u0623\u0633\u0631 \u0627\u062D\u0645\u062F \u0643\u0645\u0627\u0644 \u0627\u0644\u062F\u064A\u0646 \u064A\u0648\u0633\u0641", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-004" },
  { id: "st_4b_5", name: "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F \u0645\u062C\u0627\u0647\u062F", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-005" },
  { id: "st_4b_6", name: "\u0645\u0631\u0648\u0627\u0646 \u0645\u062D\u0645\u0648\u062F \u0636\u0627\u062D\u064A \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-006" },
  { id: "st_4b_7", name: "\u0627\u062F\u0645 \u0648\u0627\u0646\u0644 \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u062D\u0645\u062F", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-007" },
  { id: "st_4b_8", name: "\u0639\u0645\u0631 \u0645\u0635\u0637\u0641\u0649 \u0641\u0627\u064A\u062F \u0645\u062D\u0645\u062F", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-008" },
  { id: "st_4b_9", name: "\u0635\u0644\u0627\u062D \u0627\u0644\u062F\u064A\u0646 \u0634\u0631\u064A\u0641 \u0635\u0644\u0627\u062D \u0645\u062D\u0645\u062F", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-009" },
  { id: "st_4b_10", name: "\u0645\u0631\u0648\u0627\u0646 \u0623\u062D\u0645\u062F \u0639\u0627\u062F\u0644 \u0627\u0644\u0634\u0627\u0645\u064A", classId: "class_gr4___b", track: "english", studentCode: "GR4-B-010" },
  // GR 5A
  { id: "st_5a_1", name: "\u062A\u064A\u0645 \u0627\u0644\u0644\u0647 \u0635\u0647\u064A\u0628 \u0627\u0628\u0648\u0627\u0644\u0643\u0627\u0645\u0644 \u0639\u0644\u064A", classId: "class_gr5___a", track: "arabic", studentCode: "GR5-A-001" },
  { id: "st_5a_2", name: "\u0627\u0633\u0631 \u0627\u062D\u0645\u062F \u0632\u0643\u064A \u0632\u0643\u064A", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-002" },
  { id: "st_5a_3", name: "\u0627\u0644\u0628\u0631\u0627\u0621 \u0623\u062D\u0645\u062F \u0634\u0639\u0628\u0627\u0646", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-003" },
  { id: "st_5a_4", name: "\u062D\u0633\u0646 \u0646\u0627\u062F\u0631 \u062D\u0633\u0646 \u0645\u062D\u0645\u062F", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-004" },
  { id: "st_5a_5", name: "\u062D\u0645\u0632\u0629 \u0639\u0627\u0645\u0631 \u0645\u062C\u062F\u064A \u0627\u0644\u0634\u0631\u0628\u064A\u0646\u064A", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-005" },
  { id: "st_5a_6", name: "\u062D\u0645\u0632\u0647 \u0645\u062D\u0645\u062F \u0633\u064A\u062F \u0627\u062D\u0645\u062F \u0627\u0644\u0643\u0646\u0627\u0646\u064A", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-006" },
  { id: "st_5a_7", name: "\u062D\u0645\u0632\u0647 \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0633\u0627\u0644\u0645", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-007" },
  { id: "st_5a_8", name: "\u0633\u064A\u0641 \u0627\u062D\u0645\u062F \u062F\u0631\u0648\u064A\u0634 \u0645\u062D\u0645\u062F \u062F\u0631\u0648\u064A\u0634", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-008" },
  { id: "st_5a_9", name: "\u0639\u0645\u0631 \u0627\u062D\u0645\u062F \u062F\u0631\u0648\u064A\u0634 \u0645\u062D\u0645\u062F \u062F\u0631\u0648\u064A\u0634", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-009" },
  { id: "st_5a_10", name: "\u0639\u0645\u0631 \u062D\u0633\u0646 \u0645\u062D\u064A\u064A \u0627\u0644\u062F\u064A\u0646 \u062D\u0633\u064A\u0646", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-010" },
  { id: "st_5a_11", name: "\u0641\u0647\u062F \u0645\u0627\u0647\u0631 \u0627\u062D\u0645\u062F \u062D\u0645\u0632\u0647", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-011" },
  { id: "st_5a_12", name: "\u0622\u062F\u0645 \u0645\u062D\u0645\u062F \u0645\u0646\u064A\u0631", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-012" },
  { id: "st_5a_13", name: "\u0645\u0627\u0632\u0646 \u0645\u0639\u062A\u0632 \u0645\u062D\u0645\u062F \u0627\u0644\u0648\u0643\u064A\u0644", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-013" },
  { id: "st_5a_14", name: "\u0645\u062D\u0645\u062F \u0633\u064A\u062F \u0645\u062D\u0645\u062F \u0639\u0648\u0641", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-014" },
  { id: "st_5a_15", name: "\u0645\u0639\u062A\u0632 \u0645\u062D\u0645\u0648\u062F \u0645\u062D\u0645\u062F \u0627\u0644\u0645\u063A\u0631\u0628\u064A", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-015" },
  { id: "st_5a_16", name: "\u0627\u0644\u0645\u0639\u062A\u0635\u0645 \u0628\u0627\u0644\u0644\u0647 \u0645\u062D\u0645\u062F \u0627\u0644\u0633\u064A\u062F \u0645\u062D\u0645\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-016" },
  { id: "st_5a_17", name: "\u064A\u0627\u0633\u064A\u0646 \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645 \u0645\u0635\u0637\u0641\u0649 \u0627\u0644\u062F\u0631\u062F\u064A\u0631\u064A", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-017" },
  { id: "st_5a_18", name: "\u0639\u0645\u0631 \u0634\u0647\u0627\u0628 \u0627\u0644\u062F\u064A\u0646 \u0637\u0627\u0631\u0642 \u0645\u062D\u0645\u062F\u064A\u0646", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-018" },
  { id: "st_5a_19", name: "\u0645\u062D\u0645\u062F \u0636\u064A\u0627\u0621 \u0631\u0628\u064A\u0639 \u0627\u0644\u0647\u0631\u064A\u062C\u064A", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-019" },
  { id: "st_5a_20", name: "\u0645\u062D\u0645\u062F \u0648\u0627\u0626\u0644 \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u062D\u0645\u062F", classId: "class_gr5___a", track: "arabic", studentCode: "GR5-A-020" },
  { id: "st_5a_21", name: "\u062D\u0645\u0632\u0629 \u0639\u0644\u064A \u0639\u0644\u0627\u0621", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-021" },
  { id: "st_5a_22", name: "\u0627\u062D\u0645\u062F \u0639\u0645\u0631\u0648 \u0631\u0632\u0642", classId: "class_gr5___a", track: "english", studentCode: "GR5-A-022" },
  // GR 6A
  { id: "st_6a_1", name: "\u0627\u0633\u0631 \u0627\u062D\u0645\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0633\u0639\u0627\u062F\u0629", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-001" },
  { id: "st_6a_2", name: "\u0627\u064A\u0627\u062F \u0645\u062D\u0645\u0648\u062F \u064A\u0633\u0631\u064A \u0645\u062D\u0645\u062F", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-002" },
  { id: "st_6a_3", name: "\u0628\u0644\u0627\u0644 \u0634\u0631\u064A\u0641 \u0645\u062D\u0645\u062F \u0633\u0639\u064A\u062F", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-003" },
  { id: "st_6a_4", name: "\u062E\u0627\u0644\u062F \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0647", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-004" },
  { id: "st_6a_5", name: "\u0633\u0644\u064A\u0645 \u062E\u0627\u0644\u062F \u0628\u062F\u0631 \u0645\u062D\u0645\u062F", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-005" },
  { id: "st_6a_6", name: "\u0635\u0627\u0644\u062D \u0645\u062D\u0645\u062F \u0634\u0639\u0628\u0627\u0646 \u0645\u062D\u0645\u0648\u062F \u0628\u062F\u0648\u064A", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-006" },
  { id: "st_6a_7", name: "\u0639\u0627\u0635\u0645 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0627\u0644\u0645\u0627\u0644\u0643\u064A", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-007" },
  { id: "st_6a_8", name: "\u0639\u0628\u062F \u0627\u0644\u0644\u0647 \u0645\u0635\u0637\u0641\u0649 \u0628\u0643\u0631\u064A \u0627\u0644\u0639\u064A\u0633\u0648\u0649", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-008" },
  { id: "st_6a_9", name: "\u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0639\u0644\u064A \u0631\u062C\u0628", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-009" },
  { id: "st_6a_10", name: "\u0645\u0627\u0632\u0646 \u062D\u0633\u0627\u0645 \u0627\u0644\u062F\u064A\u0646 \u0639\u0628\u062F\u0627\u0644\u0645\u0639\u0632", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-010" },
  { id: "st_6a_11", name: "\u0645\u0627\u0644\u0643 \u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-011" },
  { id: "st_6a_12", name: "\u0645\u062D\u0645\u062F \u0627\u0633\u0627\u0644\u0645 \u0645\u062D\u0645\u062F \u062D\u0633\u064A\u0646 \u0627\u062D\u0645\u062F", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-012" },
  { id: "st_6a_13", name: "\u0645\u062D\u0645\u062F \u062E\u0627\u0644\u062F \u0634\u0639\u0628\u0627\u0646 \u0633\u0627\u0644\u0645", classId: "class_gr6___a", track: "english", studentCode: "GR6-A-013" },
  { id: "st_6a_14", name: "\u0645\u062D\u0645\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u064A\u0633\u0649 \u0634\u0631\u064A\u062F\u0645", classId: "class_gr6___a", track: "arabic", studentCode: "GR6-A-014" },
  // GR 7A
  { id: "st_7a_1", name: "\u0623\u062D\u0645\u062F \u062E\u0627\u0644\u062F \u0627\u0644\u0634\u0631\u0628\u064A\u0646\u064A", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-001" },
  { id: "st_7a_2", name: "\u0623\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u062D\u0645\u064A\u062F \u0623\u0634\u0631\u0641 \u0639\u0628\u062F\u0627\u0644\u0645\u0637\u0644\u0628", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-002" },
  { id: "st_7a_3", name: "\u0622\u062F\u0645 \u0639\u0632\u062A \u0639\u0644\u064A \u062E\u0644\u064A\u0644", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-003" },
  { id: "st_7a_4", name: "\u0622\u062F\u0645 \u0645\u062D\u0645\u0648\u062F \u0627\u0644\u0635\u0627\u0648\u064A \u0645\u062D\u0645\u062F", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-004" },
  { id: "st_7a_5", name: "\u0623\u0646\u0633 \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0641\u062A\u0627\u062D", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-005" },
  { id: "st_7a_6", name: "\u062D\u0645\u0632\u0629 \u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0648\u0643\u064A\u0644", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-006" },
  { id: "st_7a_7", name: "\u0639\u0645\u0631 \u0634\u0639\u0628\u0627\u0646 \u0635\u0627\u0628\u0631 \u0639\u0628\u062F \u0627\u0644\u0639\u0632\u064A\u0632", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-007" },
  { id: "st_7a_8", name: "\u0639\u0645\u0631 \u0639\u0644\u0649 \u0623\u062D\u0645\u062F \u064A\u0648\u0633\u0641 \u0631\u062C\u0628", classId: "class_gr7___a", track: "arabic", studentCode: "GR7-A-008" },
  { id: "st_7a_9", name: "\u0639\u0645\u0631 \u0645\u0635\u0637\u0641\u0649 \u062D\u0633\u0646 \u0630\u0643\u064A", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-009" },
  { id: "st_7a_10", name: "\u0643\u0631\u064A\u0645 \u062D\u0633\u0627\u0645 \u0627\u0644\u062F\u064A\u0646 \u0639\u0628\u062F\u0627\u0644\u0645\u0639\u0632", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-010" },
  { id: "st_7a_11", name: "\u0645\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0628\u062F\u0648\u064A", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-011" },
  { id: "st_7a_12", name: "\u064A\u0627\u0633\u064A\u0646 \u0627\u0628\u0631\u0627\u0647\u064A\u0645 \u0645\u0635\u0637\u0641\u0649", classId: "class_gr7___a", track: "arabic", studentCode: "GR7-A-012" },
  { id: "st_7a_13", name: "\u064A\u0627\u0633\u064A\u0646 \u0627\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 \u062D\u0644\u064A\u0645\u0647", classId: "class_gr7___a", track: "arabic", studentCode: "GR7-A-013" },
  { id: "st_7a_14", name: "\u064A\u0632\u064A\u062F \u0635\u0627\u0644\u062D \u062C\u0645\u0639\u0629 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-014" },
  { id: "st_7a_15", name: "\u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0627\u062D\u0645\u062F \u0639\u0644\u064A", classId: "class_gr7___a", track: "arabic", studentCode: "GR7-A-015" },
  { id: "st_7a_16", name: "\u0627\u0646\u0633 \u0639\u0628\u062F \u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0637\u0627 \u0627\u0644\u0644\u0647 \u0627\u062F\u0645", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-016" },
  { id: "st_7a_17", name: "\u0639\u0644\u064A \u0627\u0633\u0644\u0627\u0645 \u0639\u0644\u064A \u0631\u0645\u0636\u0627\u0646", classId: "class_gr7___a", track: "english", studentCode: "GR7-A-017" },
  { id: "st_7a_18", name: "\u0645\u0631\u0648\u0627\u0646 \u062E\u0627\u0644\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632", classId: "class_gr7___a", track: "arabic", studentCode: "GR7-A-018" },
  { id: "st_7a_19", name: "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0633\u0627\u0645\u062D \u0639\u0628\u062F\u0627\u0644\u0645\u0631\u0636\u064A", classId: "class_gr7___a", track: "arabic", studentCode: "GR7-A-019" },
  // GR 7B
  { id: "st_7b_1", name: "\u0623\u062D\u0645\u062F \u062C\u0627\u0628\u0631 \u0631\u062C\u0628 \u0627\u0644\u0628\u0631\u0627\u0648\u064A", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-001" },
  { id: "st_7b_2", name: "\u0623\u0646\u0633 \u0627\u062D\u0645\u062F \u0627\u0644\u0633\u064A\u062F \u0627\u0644\u0646\u062C\u0627\u0631", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-002" },
  { id: "st_7b_3", name: "\u0625\u064A\u0627\u062F \u0645\u062D\u0645\u062F \u0623\u0634\u0631\u0641 \u0623\u0646\u0648\u0631 \u0645\u0646\u0635\u0648\u0631", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-003" },
  { id: "st_7b_4", name: "\u062C\u0627\u0633\u0631 \u0634\u0631\u064A\u0641 \u0639\u0628\u062F\u0627\u0644\u0645\u0646\u0639\u0645 \u0627\u062D\u0645\u062F", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-004" },
  { id: "st_7b_5", name: "\u0639\u0645\u0631 \u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0648\u0647\u0627\u0628 \u0647\u062C\u0631\u0633", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-005" },
  { id: "st_7b_6", name: "\u0639\u0645\u0631 \u0645\u0646\u062A\u0635\u0631 \u0645\u062D\u0645\u062F \u063A\u0646\u064A\u0645", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-006" },
  { id: "st_7b_7", name: "\u0643\u0631\u064A\u0645 \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645 \u0645\u0635\u0637\u0641\u0649 \u062F\u0631\u064A\u0631\u064A", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-007" },
  { id: "st_7b_8", name: "\u0643\u0631\u064A\u0645 \u0645\u062D\u0645\u062F \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0648\u0647\u0627\u0628", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-008" },
  { id: "st_7b_9", name: "\u0645\u062D\u0645\u062F \u0627\u062D\u0645\u062F \u0634\u0639\u0628\u0627\u0646 \u0639\u0628\u062F \u0627\u0644\u062D\u0633\u0627\u0628", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-009" },
  { id: "st_7b_10", name: "\u0645\u062D\u0645\u062F \u0645\u0635\u0637\u0641\u0649 \u0645\u062D\u0645\u062F \u0639\u0627\u0645\u0631", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-010" },
  { id: "st_7b_11", name: "\u064A\u062D\u064A\u0649 \u0639\u0645\u0631\u0648 \u0645\u062D\u0645\u062F \u0639\u064A\u0633\u0649", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-011" },
  { id: "st_7b_12", name: "\u064A\u0648\u0633\u0641 \u0645\u062D\u0645\u062F \u062C\u0645\u0639\u0629", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-012" },
  { id: "st_7b_13", name: "\u064A\u0648\u0633\u0641 \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0646\u0635\u0627\u0631", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-013" },
  { id: "st_7b_14", name: "\u0627\u062F\u0645 \u0641\u062A\u062D\u064A \u0645\u0633\u0639\u062F \u0645\u0633\u0639\u062F", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-014" },
  { id: "st_7b_15", name: "\u0627\u0633\u0627\u0645\u0647 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u062D\u062C\u0627\u0632\u064A", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-015" },
  { id: "st_7b_16", name: "\u064A\u0648\u0633\u0641 \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645 \u0627\u0644\u0634\u064A\u062E", classId: "class_gr7___b", track: "english", studentCode: "GR7-B-016" },
  // GR 8A
  { id: "st_8a_1", name: "\u0627\u062F\u0645 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-001" },
  { id: "st_8a_2", name: "\u0627\u062F\u0645 \u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0645\u062C\u062F\u064A \u062D\u0627\u0641\u0638", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-002" },
  { id: "st_8a_3", name: "\u0627\u0646\u0633 \u0645\u062D\u0645\u062F \u0634\u0639\u0628\u0627\u0646 \u0645\u062D\u0645\u0648\u062F \u0628\u062F\u0648\u064A", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-003" },
  { id: "st_8a_4", name: "\u0627\u064A\u0627\u062F \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0639\u064A\u0633\u0649 \u0643\u0645\u0627\u0644 \u0634\u0631\u064A\u062F\u0645", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-004" },
  { id: "st_8a_5", name: "\u0628\u062F\u0648\u064A \u0645\u062D\u0645\u0648\u062F \u0628\u062F\u0648\u064A \u0625\u0633\u062D\u0627\u0642", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-005" },
  { id: "st_8a_6", name: "\u0645\u062D\u0645\u062F \u062E\u0627\u0644\u062F \u0645\u062D\u0645\u062F \u0627\u0633\u0645\u0627\u0639\u064A\u0644", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-006" },
  { id: "st_8a_7", name: "\u0639\u0627\u062F\u0644 \u0639\u0644\u064A \u0639\u0627\u062F\u0644 \u0639\u0644\u064A \u0627\u062D\u0645\u062F", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-007" },
  { id: "st_8a_8", name: "\u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u062E\u0627\u0644\u062F \u0645\u062D\u0645\u062F \u0627\u0644\u0634\u0631\u0628\u064A\u0646\u064A", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-008" },
  { id: "st_8a_9", name: "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0637\u0647 \u0646\u0627\u0635\u0641 \u064A\u0648\u0646\u0633", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-009" },
  { id: "st_8a_10", name: "\u0645\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0644\u0647 \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0647 \u0627\u0644\u0645\u0637\u0631\u0649", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-010" },
  { id: "st_8a_11", name: "\u0645\u062D\u0645\u062F \u0645\u0635\u0637\u0641\u0649 \u062E\u064A\u0631 \u0627\u0644\u0644\u0647 \u0639\u0628\u062F \u0627\u0644\u062D\u0645\u064A\u062F", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-011" },
  { id: "st_8a_12", name: "\u0645\u062D\u0645\u0648\u062F \u0627\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u062D\u0645\u062F", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-012" },
  { id: "st_8a_13", name: "\u0645\u0639\u0627\u0630 \u0645\u062D\u0645\u062F \u062D\u0633\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u0642\u064A\u0645\u0629", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-013" },
  { id: "st_8a_14", name: "\u064A\u0627\u0633\u064A\u0646 \u0627\u062D\u0645\u062F \u062D\u0627\u0645\u062F \u062C\u0645\u0627\u0644 \u0627\u0644\u062F\u064A\u0646", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-014" },
  { id: "st_8a_15", name: "\u064A\u0648\u0633\u0641 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0647", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-015" },
  { id: "st_8a_16", name: "\u0632\u064A\u0627\u062F \u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-016" },
  { id: "st_8a_17", name: "\u062A\u0645\u064A\u0645 \u0635\u0647\u064A\u0628 \u0627\u0628\u0648 \u0627\u0644\u0645\u0643\u0627\u0631\u0645 \u0639\u0644\u064A", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-017" },
  { id: "st_8a_18", name: "\u0645\u0635\u0637\u0641\u0649 \u0627\u0634\u0631\u0641 \u0635\u0644\u0627\u062D \u0627\u0644\u0633\u0642\u0627", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-018" },
  { id: "st_8a_19", name: "\u064A\u0627\u0633\u064A\u0646 \u0639\u0645\u0631\u0648 \u0632\u0643\u0631\u064A\u0627 \u063A\u0627\u0632\u064A", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-019" },
  { id: "st_8a_20", name: "\u0639\u0645\u0631 \u0627\u0644\u0633\u064A\u062F \u0627\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0628\u0631\u0627\u0647\u064A\u0645", classId: "class_gr8___a", track: "arabic", studentCode: "GR8-A-020" },
  { id: "st_8a_21", name: "\u062D\u0645\u0632\u0647 \u0645\u062D\u0645\u0648\u062F \u0645\u062D\u0645\u062F \u0645\u0635\u0637\u0641\u0649", classId: "class_gr8___a", track: "english", studentCode: "GR8-A-021" },
  // GR 9A
  { id: "st_9a_1", name: "\u0623\u062D\u0645\u062F \u062D\u0633\u0646 \u0645\u062D\u064A\u064A \u0627\u0644\u062F\u064A\u0646 \u062D\u0633\u0646", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-001" },
  { id: "st_9a_2", name: "\u0627\u062D\u0645\u062F \u0645\u062C\u062F\u064A \u0645\u062D\u0645\u062F \u0627\u0644\u0635\u0627\u0648\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-002" },
  { id: "st_9a_3", name: "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F \u0627\u0644\u063A\u0631\u0628\u0627\u0648\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-003" },
  { id: "st_9a_4", name: "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0623\u062D\u0645\u062F \u062C\u0646\u062F\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-004" },
  { id: "st_9a_5", name: "\u0632\u064A\u0627\u062F \u0645\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u063A\u0632\u0627\u0644\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-005" },
  { id: "st_9a_6", name: "\u0639\u0645\u0631 \u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0644\u0649", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-006" },
  { id: "st_9a_7", name: "\u0643\u0631\u064A\u0645 \u0645\u062D\u0645\u062F \u062D\u0633\u0646 \u0633\u0639\u062F \u0627\u0644\u0634\u0627\u0630\u0644\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-007" },
  { id: "st_9a_8", name: "\u0645\u062D\u0645\u062F \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0638\u064A\u0645", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-008" },
  { id: "st_9a_9", name: "\u0645\u0631\u0648\u0627\u0646 \u0645\u062D\u0645\u0648\u062F \u0645\u062D\u0645\u062F \u0627\u0644\u0645\u063A\u0631\u0628\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-009" },
  { id: "st_9a_10", name: "\u0645\u0639\u062A\u0635\u0645 \u0628\u0627\u0647\u0644\u0644 \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0645\u062A\u0648\u0644\u064A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-010" },
  { id: "st_9a_11", name: "\u064A\u0648\u0633\u0641 \u0634\u0639\u0628\u0627\u0646 \u0635\u0627\u0628\u0631 \u0639\u0628\u062F \u0627\u0644\u0639\u0632\u064A\u0632", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-011" },
  { id: "st_9a_12", name: "\u0627\u064A\u0627\u062F \u0627\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0637\u0644\u0639\u062A", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-012" },
  { id: "st_9a_13", name: "\u0627\u0646\u0633 \u0634\u0631\u064A\u0641 \u0635\u0644\u0627\u062D \u0645\u062D\u0645\u062F", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-013" },
  { id: "st_9a_14", name: "\u0639\u0645\u0631 \u0647\u0634\u0627\u0645 \u0627\u0644\u0633\u064A\u062F \u0631\u0636\u0648\u0627\u0646", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-014" },
  { id: "st_9a_15", name: "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0639\u0645\u0631\u0648 \u0631\u0632\u0642", classId: "class_gr9___a", track: "english", studentCode: "GR9-A-015" }
];

// src/utils/excelParser.ts
import * as XLSX from "xlsx";
function normalizeClassKey(name) {
  if (!name) return "";
  let clean = name.toLowerCase().replace(/^فصل\s+/, "").replace(/^الصف\s+/, "").replace(/^صف\s+/, "").replace(/^grade\s*/, "gr").replace(/^prep\s*/, "prep").replace(/^sec\s*/, "sec");
  clean = clean.replace(/[\[\(]?(مسار عربي|المسار العربي|عربي|arabic)[\]\)]?/gi, "").replace(/[\[\(]?(مسار لغات|مسار اللغات|لغات|languages|english|انجليزي)[\]\)]?/gi, "").replace(/[\s\-_–—]/g, "").trim();
  return clean;
}
function mergeDuplicateClasses(classes, students, sessions = []) {
  if (!Array.isArray(classes) || classes.length <= 1) {
    return { classes, students, sessions, mergedCount: 0 };
  }
  const classGroups = /* @__PURE__ */ new Map();
  classes.forEach((c) => {
    const key = normalizeClassKey(c.name);
    if (!classGroups.has(key)) {
      classGroups.set(key, []);
    }
    classGroups.get(key).push(c);
  });
  const mergedClasses = [];
  const idRemap = /* @__PURE__ */ new Map();
  const canonicalNameMap = /* @__PURE__ */ new Map();
  let mergedCount = 0;
  for (const [_key, group] of classGroups.entries()) {
    if (group.length === 1) {
      mergedClasses.push(group[0]);
      idRemap.set(group[0].id, group[0].id);
      canonicalNameMap.set(group[0].id, group[0].name);
    } else {
      mergedCount += group.length - 1;
      const sorted = [...group].sort((a, b) => {
        const aHasTrack = /لغات|عربي|arabic|english/i.test(a.name);
        const bHasTrack = /لغات|عربي|arabic|english/i.test(b.name);
        if (!aHasTrack && bHasTrack) return -1;
        if (aHasTrack && !bHasTrack) return 1;
        return a.name.length - b.name.length;
      });
      const canonical = sorted[0];
      const cleanName = canonical.name.replace(/[\[\(]?(مسار عربي|المسار العربي|عربي|arabic)[\]\)]?/gi, "").replace(/[\[\(]?(مسار لغات|مسار اللغات|لغات|languages|english|انجليزي)[\]\)]?/gi, "").replace(/[\-–—\s]+$/, "").trim();
      const finalCanonical = {
        ...canonical,
        name: cleanName || canonical.name
      };
      mergedClasses.push(finalCanonical);
      group.forEach((c) => {
        idRemap.set(c.id, finalCanonical.id);
        canonicalNameMap.set(c.id, finalCanonical.name);
      });
    }
  }
  const studentMap = /* @__PURE__ */ new Map();
  students.forEach((st) => {
    if (!st || typeof st !== "object" || !st.name || typeof st.name !== "string") return;
    const cleanName = st.name.trim();
    if (!cleanName) return;
    const targetClassId = idRemap.get(st.classId) || st.classId;
    const dedupKey = `${targetClassId}_${cleanName.toLowerCase()}`;
    if (studentMap.has(dedupKey)) {
      const existing = studentMap.get(dedupKey);
      const preservedTrack = existing.track || st.track || "english";
      studentMap.set(dedupKey, {
        ...existing,
        track: preservedTrack,
        studentCode: existing.studentCode || st.studentCode
      });
    } else {
      studentMap.set(dedupKey, {
        ...st,
        name: cleanName,
        classId: targetClassId,
        track: st.track || "english"
      });
    }
  });
  const updatedSessions = sessions.map((s) => {
    const targetClassId = idRemap.get(s.classId) || s.classId;
    const targetClassName = canonicalNameMap.get(s.classId) || s.className;
    return {
      ...s,
      classId: targetClassId,
      className: targetClassName
    };
  });
  return {
    classes: mergedClasses,
    students: enforceOfficialStudentTracks(Array.from(studentMap.values())),
    sessions: updatedSessions,
    mergedCount
  };
}

// src/utils/urlHelper.ts
function ensureAbsoluteUrl(url) {
  if (!url) {
    return "https://zoom.us";
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return "https://zoom.us";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
var STORAGE_KEY_PUBLISHED_DOMAIN = "zoom_attendance_published_domain";
var PUBLIC_VERCEL_DOMAIN = "https://zoom2000.vercel.app";
function getActiveSiteOrigin() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    let origin = window.location.origin.replace(/\/+$/, "");
    if (origin.includes("ais-dev-")) {
      origin = origin.replace("ais-dev-", "ais-pre-");
    }
    return origin;
  }
  return PUBLIC_VERCEL_DOMAIN;
}
var DEFAULT_PUBLISHED_DOMAIN = getActiveSiteOrigin();
function ensureAbsoluteDomain(domain) {
  const currentOrigin = getActiveSiteOrigin();
  let cleaned = (domain || "").trim().replace(/\/+$/, "");
  if (!cleaned || cleaned.includes("zoom123")) {
    return currentOrigin || PUBLIC_VERCEL_DOMAIN;
  }
  if (cleaned.includes("ais-dev-")) {
    cleaned = cleaned.replace("ais-dev-", "ais-pre-");
  }
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
}
function isInternalPlatformOrigin(origin) {
  if (!origin) return false;
  return origin.includes("ais-dev-") || origin.includes("ais-pre-") || origin.includes("googleusercontent.com") || origin.includes("run.app") || origin.includes("localhost:");
}
function getPublishedDomain() {
  const currentOrigin = getActiveSiteOrigin();
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PUBLISHED_DOMAIN);
      if (saved && !isInternalPlatformOrigin(saved) && !saved.includes("zoom123")) {
        return ensureAbsoluteDomain(saved);
      }
    } catch {
    }
  }
  if (isInternalPlatformOrigin(currentOrigin)) {
    return PUBLIC_VERCEL_DOMAIN;
  }
  return currentOrigin || PUBLIC_VERCEL_DOMAIN;
}
function buildRelativeAttendanceUrl(session, teacher) {
  const cleanZoomUrl = ensureAbsoluteUrl(session.zoomUrl);
  const params = new URLSearchParams();
  params.set("attend", session.id);
  params.set("cid", session.classId || "class_auto");
  params.set("cls", session.className || "\u0627\u0644\u0641\u0635\u0644");
  params.set("title", session.sessionTitle || "\u062D\u0635\u0629 \u062F\u0631\u0627\u0633\u064A\u0629");
  params.set("zoom", cleanZoomUrl);
  params.set("trk", session.targetTrack || "all");
  if (teacher) {
    params.set("t", teacher.name);
    params.set("sub", teacher.subject);
    params.set("tid", teacher.id);
  } else {
    params.set("tid", session.teacherId || "teacher_ahmed_badawi");
  }
  return `/?${params.toString()}#attend/${encodeURIComponent(session.id)}`;
}
function buildStudentAttendanceLink(session, teacher, customDomain) {
  let targetDomain = customDomain ? ensureAbsoluteDomain(customDomain) : getPublishedDomain();
  if (isInternalPlatformOrigin(targetDomain)) {
    targetDomain = PUBLIC_VERCEL_DOMAIN;
  }
  const baseDomain = (targetDomain || PUBLIC_VERCEL_DOMAIN).replace(/\/+$/, "");
  const relativePart = buildRelativeAttendanceUrl(session, teacher);
  return `${baseDomain}${relativePart}`;
}

// src/utils/whatsappHelper.ts
var DEFAULT_REMINDER_TEMPLATE = `\u{1F514} *\u062A\u0630\u0643\u064A\u0631 \u0628\u0645\u0648\u0639\u062F \u062D\u0635\u0629 \u0632\u0648\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 ({\u0648\u0642\u062A_\u0627\u0644\u062A\u0630\u0643\u064A\u0631})*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4DA} *\u0627\u0644\u0641\u0635\u0644:* {\u0627\u0644\u0641\u0635\u0644}
\u{1F4D6} *\u0627\u0644\u0645\u0627\u062F\u0629 / \u0627\u0644\u0639\u0646\u0648\u0627\u0646:* {\u0627\u0644\u0645\u0627\u062F\u0629}
\u{1F464} *\u0627\u0644\u0645\u0639\u0644\u0645:* {\u0627\u0644\u0645\u0639\u0644\u0645}
\u23F0 *\u0627\u0644\u0645\u0648\u0639\u062F:* {\u0627\u0644\u0645\u0648\u0639\u062F}
\u{1F3AF} *\u0627\u0644\u0641\u0626\u0629:* {\u0627\u0644\u0641\u0626\u0629}

\u{1F517} *\u0631\u0627\u0628\u0637 \u0632\u0648\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631:*
{\u0631\u0627\u0628\u0637_\u0632\u0648\u0645}

\u{1F4DD} *\u062A\u0633\u062C\u064A\u0644 \u062D\u0636\u0648\u0631 \u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0630\u0643\u064A:*
{\u0631\u0627\u0628\u0637_\u0627\u0644\u062D\u0636\u0648\u0631}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
_\u0646\u0631\u062C\u0648 \u0645\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u062F\u062E\u0648\u0644 \u0641\u0648\u0631\u0627\u064B \u0639\u0628\u0631 \u0631\u0627\u0628\u0637 \u0627\u0644\u062D\u0636\u0648\u0631 \u0644\u062A\u0633\u062C\u064A\u0644 \u0623\u0633\u0645\u0627\u0626\u0647\u0645 \u0648\u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0644\u0644\u062D\u0635\u0629._`;
function getTimingLabel(minutesBefore) {
  if (minutesBefore <= 0) return "\u0627\u0644\u0622\u0646";
  if (minutesBefore === 1) return "\u0642\u0628\u0644 \u062F\u0642\u064A\u0642\u0629 \u0648\u0627\u062D\u062F\u0629";
  if (minutesBefore === 2) return "\u0642\u0628\u0644 \u062F\u0642\u064A\u0642\u062A\u064A\u0646";
  if (minutesBefore >= 3 && minutesBefore <= 10) return `\u0642\u0628\u0644 ${minutesBefore} \u062F\u0642\u0627\u0626\u0642`;
  return `\u0642\u0628\u0644 ${minutesBefore} \u062F\u0642\u064A\u0642\u0629`;
}
function getStatusLabel(minutesBefore) {
  if (minutesBefore <= 0) return "\u062A\u0628\u062F\u0623 \u0627\u0644\u0622\u0646";
  if (minutesBefore === 1) return "\u062A\u0628\u062F\u0623 \u0628\u0639\u062F \u062F\u0642\u064A\u0642\u0629 \u0648\u0627\u062D\u062F\u0629";
  if (minutesBefore === 2) return "\u062A\u0628\u062F\u0623 \u0628\u0639\u062F \u062F\u0642\u064A\u0642\u062A\u064A\u0646";
  if (minutesBefore >= 3 && minutesBefore <= 10) return `\u062A\u0628\u062F\u0623 \u0628\u0639\u062F ${minutesBefore} \u062F\u0642\u0627\u0626\u0642`;
  return `\u062A\u0628\u062F\u0623 \u0628\u0639\u062F ${minutesBefore} \u062F\u0642\u064A\u0642\u0629`;
}
function formatTimeTo12Hour(timeStr) {
  if (!timeStr || !timeStr.trim()) return "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646";
  const trimmed = timeStr.trim();
  if (trimmed === "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646" || trimmed === "\u0645\u0628\u0627\u0634\u0631" || trimmed === "\u0627\u0644\u0622\u0646" || trimmed === "now" || trimmed === "Direct Now") {
    return "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646";
  }
  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|ص|م)?/i);
  if (!match) return trimmed;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = (match[3] || "").toLowerCase();
  let isPm = false;
  if (ampm) {
    isPm = ampm === "pm" || ampm === "\u0645";
    if (hours === 0) hours = 12;
    else if (hours > 12) hours = hours - 12;
  } else {
    isPm = hours >= 12;
    hours = hours % 12;
    if (hours === 0) hours = 12;
  }
  const formattedHours = String(hours).padStart(2, "0");
  const periodStr = isPm ? "\u0645" : "\u0635";
  return `${formattedHours}:${minutes} ${periodStr}`;
}
function buildWhatsAppReminderMessage(params) {
  const { session, schoolClass, teacher, appUrl, customTemplate, minutesBefore = 5 } = params;
  const attendanceLink = buildStudentAttendanceLink(session, teacher, appUrl);
  const zoomUrl = session.zoomUrl || teacher?.classZoomLinks?.[session.classId] || schoolClass?.zoomUrl || teacher?.defaultZoomLink || "\u0631\u0627\u0628\u0637 \u0632\u0648\u0645 \u0645\u062A\u0627\u062D \u062F\u0627\u062E\u0644 \u0627\u0644\u0628\u0648\u0627\u0628\u0629";
  const rawTimeStr = session.scheduledTime ? session.scheduledTime : "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646";
  const formattedTime12 = formatTimeTo12Hour(rawTimeStr);
  const trackLabel = session.targetTrack === "english" ? "\u0645\u0633\u0627\u0631 \u0627\u0644\u0644\u063A\u0627\u062A (English)" : session.targetTrack === "arabic" ? "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0639\u0631\u0628\u064A (Arabic)" : "\u0639\u0627\u0645 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0637\u0644\u0627\u0628";
  const timingLabel = getTimingLabel(minutesBefore);
  const statusLabel = getStatusLabel(minutesBefore);
  const today = /* @__PURE__ */ new Date();
  const daysArabic = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
  const todayDayName = daysArabic[today.getDay()] || "";
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const todayDateStr = today.toLocaleDateString("ar-EG", options);
  const schoolName = teacher?.schoolName || "\u0645\u062F\u0631\u0633\u0629 \u0627\u0644\u0644\u063A\u0627\u062A \u0627\u0644\u062D\u062F\u064A\u062B\u0629";
  const variables = {
    // Class name
    "\u0627\u0644\u0641\u0635\u0644": session.className,
    "\u0627\u0633\u0645_\u0627\u0644\u0641\u0635\u0644": session.className,
    "\u0641\u0635\u0644": session.className,
    className: session.className,
    class: session.className,
    name: session.className,
    // Subject / Title
    "\u0627\u0644\u0645\u0627\u062F\u0629": session.sessionTitle,
    "\u0627\u0633\u0645_\u0627\u0644\u0645\u0627\u062F\u0629": session.sessionTitle,
    "\u0627\u0644\u0645\u0648\u0636\u0648\u0639": session.sessionTitle,
    "\u0639\u0646\u0648\u0627\u0646_\u0627\u0644\u062D\u0635\u0629": session.sessionTitle,
    "\u062F\u0631\u0633": session.sessionTitle,
    "\u0627\u0644\u0639\u0646\u0648\u0627\u0646": session.sessionTitle,
    subject: session.sessionTitle,
    sessionTitle: session.sessionTitle,
    title: session.sessionTitle,
    // Teacher
    "\u0627\u0644\u0645\u0639\u0644\u0645": teacher?.name || "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    "\u0627\u0633\u0645_\u0627\u0644\u0645\u0639\u0644\u0645": teacher?.name || "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    "\u0627\u0644\u0627\u0633\u062A\u0627\u0630": teacher?.name || "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    "\u0623\u0633\u062A\u0627\u0630": teacher?.name || "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    teacher: teacher?.name || "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    teacherName: teacher?.name || "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A",
    // Time / Schedule
    "\u0627\u0644\u0645\u0648\u0639\u062F": formattedTime12,
    "\u0627\u0644\u0648\u0642\u062A": formattedTime12,
    "\u062A\u0648\u0642\u064A\u062A": formattedTime12,
    "\u0645\u0648\u0639\u062F_\u0627\u0644\u062D\u0635\u0629": formattedTime12,
    "\u0648\u0642\u062A_\u0627\u0644\u062D\u0635\u0629": formattedTime12,
    time: formattedTime12,
    scheduledTime: formattedTime12,
    // Track
    "\u0627\u0644\u0641\u0626\u0629": trackLabel,
    "\u0627\u0644\u0645\u0633\u0627\u0631": trackLabel,
    "\u0627\u0644\u0645\u0633\u0627\u0631_\u0627\u0644\u062F\u0631\u0627\u0633\u064A": trackLabel,
    "\u0646\u0648\u0639_\u0627\u0644\u0645\u0633\u0627\u0631": trackLabel,
    track: trackLabel,
    targetTrack: trackLabel,
    // Zoom URL
    "\u0631\u0627\u0628\u0637_\u0632\u0648\u0645": zoomUrl,
    "\u0631\u0627\u0628\u0637_\u0632\u0648\u0648\u0645": zoomUrl,
    "\u0631\u0627\u0628\u0637_\u0632\u0648\u0645_\u0627\u0644\u0645\u0628\u0627\u0634\u0631": zoomUrl,
    "\u0631\u0627\u0628\u0637_\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639": zoomUrl,
    "\u0632\u0648\u0648\u0645": zoomUrl,
    "\u0632\u0648\u0645": zoomUrl,
    zoomUrl,
    zoom: zoomUrl,
    // Attendance Link
    "\u0631\u0627\u0628\u0637_\u0627\u0644\u062D\u0636\u0648\u0631": attendanceLink,
    "\u0631\u0627\u0628\u0637_\u0627\u0644\u062A\u062D\u0636\u064A\u0631": attendanceLink,
    "\u0631\u0627\u0628\u0637_\u062A\u062D\u0636\u064A\u0631_\u0627\u0644\u0637\u0644\u0627\u0628": attendanceLink,
    "\u0631\u0627\u0628\u0637_\u062A\u0633\u062C\u064A\u0644_\u0627\u0644\u062D\u0636\u0648\u0631": attendanceLink,
    "\u062A\u0633\u062C\u064A\u0644_\u0627\u0644\u062D\u0636\u0648\u0631": attendanceLink,
    attendanceLink,
    link: attendanceLink,
    // Reminder timing
    "\u0648\u0642\u062A_\u0627\u0644\u062A\u0630\u0643\u064A\u0631": timingLabel,
    "\u062A\u0648\u0642\u064A\u062A_\u0627\u0644\u062A\u0630\u0643\u064A\u0631": timingLabel,
    "\u0627\u0644\u0645\u062F\u0629_\u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629": timingLabel,
    "\u0627\u0644\u0648\u0642\u062A_\u0627\u0644\u0645\u062A\u0628\u0642\u064A": timingLabel,
    timingLabel,
    reminderTime: timingLabel,
    time_before: timingLabel,
    "\u062D\u0627\u0644\u0629_\u0627\u0644\u062A\u0630\u0643\u064A\u0631": statusLabel,
    "\u062F\u0642\u0627\u0626\u0642_\u0627\u0644\u062A\u0630\u0643\u064A\u0631": String(minutesBefore <= 0 ? 0 : minutesBefore),
    "\u0639\u062F\u062F_\u0627\u0644\u062F\u0642\u0627\u0626\u0642": String(minutesBefore <= 0 ? 0 : minutesBefore),
    minutesBefore: String(minutesBefore <= 0 ? 0 : minutesBefore),
    // Today's Date
    "\u062A\u0627\u0631\u064A\u062E_\u0627\u0644\u064A\u0648\u0645": todayDateStr,
    "\u0627\u0644\u062A\u0627\u0631\u064A\u062E": todayDateStr,
    "\u062A\u0627\u0631\u064A\u062E": todayDateStr,
    "\u0627\u0644\u064A\u0648\u0645": todayDayName,
    date: todayDateStr,
    todayDate: todayDateStr,
    // School
    "\u0627\u0644\u0645\u062F\u0631\u0633\u0629": schoolName,
    "\u0627\u0633\u0645_\u0627\u0644\u0645\u062F\u0631\u0633\u0629": schoolName,
    school: schoolName,
    schoolName
  };
  const templateToUse = customTemplate && customTemplate.trim() ? customTemplate.trim() : teacher?.whatsappConfig?.customMessageTemplate?.trim() ? teacher.whatsappConfig.customMessageTemplate.trim() : DEFAULT_REMINDER_TEMPLATE;
  let result = templateToUse;
  for (const [key, val] of Object.entries(variables)) {
    result = result.split(`{${key}}`).join(val);
    result = result.split(`{{${key}}}`).join(val);
  }
  return result;
}
function getClassWhatsAppRecipients(schoolClass, teacher) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const addRecipient = (rec, type, name) => {
    if (!rec || !rec.trim()) return;
    const clean = rec.trim();
    if (seen.has(clean)) return;
    seen.add(clean);
    const inferredType = type || (clean.includes("chat.whatsapp.com") || clean.includes("@g.us") || clean.startsWith("1203") ? "group" : "phone");
    result.push({ recipient: clean, recipientType: inferredType, name });
  };
  if (schoolClass) {
    if (Array.isArray(schoolClass.whatsappGroups)) {
      for (const grp of schoolClass.whatsappGroups) {
        if (grp && grp.recipient) {
          addRecipient(grp.recipient, grp.recipientType, grp.name);
        }
      }
    }
    if (schoolClass.whatsappRecipient?.trim()) {
      const splits = schoolClass.whatsappRecipient.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      for (const item of splits) {
        addRecipient(item, schoolClass.whatsappRecipientType);
      }
    }
  }
  if (teacher && teacher.classWhatsAppGroups) {
    const classId = schoolClass?.id || "";
    const className = schoolClass?.name || "";
    const cleanClassName = className.toLowerCase().replace(/[\s\-_]+/g, "");
    for (const [key, val] of Object.entries(teacher.classWhatsAppGroups)) {
      if (!val) continue;
      const keyClean = key.toLowerCase().replace(/[\s\-_]+/g, "");
      const isMatch = classId && key === classId || className && key === className || className && key.toLowerCase() === className.toLowerCase() || cleanClassName && keyClean === cleanClassName || className && normalizeText(key) === normalizeText(className);
      if (isMatch) {
        if (Array.isArray(val)) {
          for (const g of val) {
            if (typeof g === "string") addRecipient(g);
            else if (g && g.recipient) addRecipient(g.recipient, g.recipientType, g.name);
          }
        } else if (typeof val === "string") {
          addRecipient(val);
        }
      }
    }
  }
  return result;
}

// server.ts
var __filename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : "";
var __dirname = __filename ? path.dirname(__filename) : process.cwd();
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var cachedAiClient = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return cachedAiClient;
}
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma");
  res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
var isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
var BUNDLED_DB_FILE = path.join(__dirname, ".data", "db.json");
var DATA_DIR = isVercel ? path.join("/tmp", ".data") : path.join(__dirname, ".data");
var DB_FILE = path.join(DATA_DIR, "db.json");
function getAttendanceStudentKey(rec) {
  if (rec.studentId) return `id:${rec.studentId}`;
  const normName = normalizeText2(rec.matchedRosterName || rec.studentName || "");
  if (normName) return `name:${normName}`;
  return `rec:${rec.id}`;
}
function mergeAttendanceRecordsList(existingList = [], incomingList = [], lastResetAt) {
  const resetMs = lastResetAt ? new Date(lastResetAt).getTime() : 0;
  const map = /* @__PURE__ */ new Map();
  const processRecord = (rec) => {
    if (!rec) return;
    if (resetMs > 0) {
      const recTime = new Date(rec.lastJoinedAt || rec.timestamp || 0).getTime();
      if (!isNaN(recTime) && recTime < resetMs) {
        return;
      }
    }
    const key = getAttendanceStudentKey(rec);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...rec });
    } else {
      const prevCount = typeof prev.joinCount === "number" ? prev.joinCount : 1;
      const nextCount = typeof rec.joinCount === "number" ? rec.joinCount : 1;
      const prevTime = new Date(prev.lastJoinedAt || prev.timestamp || 0).getTime() || 0;
      const nextTime = new Date(rec.lastJoinedAt || rec.timestamp || 0).getTime() || 0;
      map.set(key, {
        ...prev,
        ...rec,
        id: prev.id || rec.id,
        studentId: rec.studentId || prev.studentId,
        matchedRosterName: rec.matchedRosterName || prev.matchedRosterName,
        track: rec.track || prev.track,
        timestamp: prev.timestamp || rec.timestamp,
        lastJoinedAt: nextTime >= prevTime ? rec.lastJoinedAt || rec.timestamp : prev.lastJoinedAt || prev.timestamp,
        joinCount: Math.max(prevCount, nextCount)
      });
    }
  };
  for (const r of existingList) processRecord(r);
  for (const r of incomingList) processRecord(r);
  return Array.from(map.values()).sort((a, b) => {
    const tA = new Date(a.lastJoinedAt || a.timestamp || 0).getTime() || 0;
    const tB = new Date(b.lastJoinedAt || b.timestamp || 0).getTime() || 0;
    return tB - tA;
  });
}
function loadDatabase() {
  try {
    let targetFile = DB_FILE;
    if (isVercel && !fs.existsSync(DB_FILE) && fs.existsSync(BUNDLED_DB_FILE)) {
      targetFile = BUNDLED_DB_FILE;
    }
    if (fs.existsSync(targetFile)) {
      const content = fs.readFileSync(targetFile, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        const rawTeachers = Array.isArray(parsed.teachers) && parsed.teachers.length > 0 ? parsed.teachers : DEFAULT_TEACHERS;
        const badawiOnly = rawTeachers.filter((t) => t.id === "teacher_ahmed_badawi" || (t.name || "").includes("\u0628\u062F\u0648\u064A"));
        const teachersList = badawiOnly.length > 0 ? badawiOnly : DEFAULT_TEACHERS;
        const badawi = teachersList[0];
        badawi.id = "teacher_ahmed_badawi";
        badawi.name = "\u0645\u0633\u062A\u0631 \u0627\u062D\u0645\u062F \u0628\u062F\u0648\u064A";
        badawi.subject = "\u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0627\u062A (Math)";
        if (!Array.isArray(badawi.weeklySchedule) || badawi.weeklySchedule.length === 0) {
          badawi.weeklySchedule = AHMED_BADAWI_OFFICIAL_SCHEDULE;
        }
        badawi.assignedClassIds = ["class_gr4___a", "class_gr4___b", "class_gr5___a", "class_gr6___a", "class_gr7___a", "class_gr8___a"];
        const cleanedLogs = Array.isArray(parsed.whatsappLogs) ? parsed.whatsappLogs.filter((l) => l && l.recipient !== "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F").slice(0, 50) : [];
        return {
          teachers: [badawi],
          currentTeacherId: "teacher_ahmed_badawi",
          classes: Array.isArray(parsed.classes) ? parsed.classes : DEFAULT_CLASSES,
          students: enforceOfficialStudentTracks(rawStudents),
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          deletedSessionIds: Array.isArray(parsed.deletedSessionIds) ? parsed.deletedSessionIds : [],
          teacherPin: typeof parsed.teacherPin === "string" && parsed.teacherPin.trim() ? parsed.teacherPin : "123654",
          whatsappLogs: cleanedLogs,
          whatsappSession: parsed.whatsappSession || {
            status: "connected",
            phoneNumber: "+966 50 123 4567",
            connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
            autoRemindEnabled: true,
            reminderMinutesBefore: 5
          },
          publishedDomain: typeof parsed.publishedDomain === "string" ? parsed.publishedDomain : void 0,
          lastUpdatedAt: typeof parsed.lastUpdatedAt === "number" ? parsed.lastUpdatedAt : Date.now()
        };
      }
    }
  } catch (err) {
    console.error("Error loading db.json, fallback to defaults:", err);
  }
  return {
    teachers: DEFAULT_TEACHERS,
    currentTeacherId: "teacher_ahmed_badawi",
    classes: DEFAULT_CLASSES,
    students: enforceOfficialStudentTracks(DEFAULT_STUDENTS),
    sessions: [],
    deletedSessionIds: [],
    teacherPin: "123654",
    whatsappLogs: [],
    whatsappSession: {
      status: "connected",
      phoneNumber: "+966 50 123 4567",
      connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
      autoRemindEnabled: true,
      reminderMinutesBefore: 5
    },
    lastUpdatedAt: Date.now()
  };
}
var db = loadDatabase();
var deletedSessionIds = new Set(db.deletedSessionIds || []);
db.students = enforceOfficialStudentTracks(db.students);
db.sessions = db.sessions.filter((s) => s && s.id && !deletedSessionIds.has(s.id));
function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db.students = enforceOfficialStudentTracks(db.students);
    db.deletedSessionIds = Array.from(deletedSessionIds);
    db.sessions = db.sessions.filter((s) => s && s.id && !deletedSessionIds.has(s.id));
    db.lastUpdatedAt = Date.now();
    if (Array.isArray(db.whatsappLogs) && db.whatsappLogs.length > 50) {
      db.whatsappLogs = db.whatsappLogs.slice(0, 50);
    }
    const tmpPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmpPath, DB_FILE);
  } catch (err) {
    console.error("Error saving db.json:", err);
  }
}
saveDatabase();
console.log(`[Startup] Cloud database synchronized with ${db.students.length} students (${db.students.filter((s) => s.track === "arabic").length} Arabic, ${db.students.filter((s) => s.track === "english").length} English).`);
if (db.sessions && db.sessions.length > 0) {
  const demoIds = /* @__PURE__ */ new Set(["ses_gr4a_math", "ses_gr4b_science", "ses_gr4a_english", "ses_gr4b_arabic"]);
  const initialCount = db.sessions.length;
  db.sessions = db.sessions.filter((s) => !demoIds.has(s.id));
  if (db.sessions.length !== initialCount) {
    console.log(`[Startup] Purged ${initialCount - db.sessions.length} legacy demo sessions.`);
    saveDatabase();
  }
}
if (db.classes && db.classes.length > 0) {
  const mergeInit = mergeDuplicateClasses(db.classes, db.students, db.sessions);
  if (mergeInit.mergedCount > 0) {
    console.log(`[Startup] Auto-merged ${mergeInit.mergedCount} duplicate classes.`);
    db.classes = mergeInit.classes;
    db.students = mergeInit.students;
    db.sessions = mergeInit.sessions;
    saveDatabase();
  }
}
function getSaudiDateString(date = /* @__PURE__ */ new Date()) {
  const saudiTime = new Date(date.getTime() + (3 * 60 + date.getTimezoneOffset()) * 6e4);
  const year = saudiTime.getFullYear();
  const month = String(saudiTime.getMonth() + 1).padStart(2, "0");
  const day = String(saudiTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
var lastSaudiResetDate = getSaudiDateString();
function checkAndTriggerSaudiMidnightReset() {
  const currentSaudiDate = getSaudiDateString();
  if (currentSaudiDate !== lastSaudiResetDate) {
    console.log(`[Saudi Midnight Reset] Date changed from ${lastSaudiResetDate} to ${currentSaudiDate}. Clearing attendance records & generating daily sessions...`);
    db.sessions = db.sessions.map((s) => ({ ...s, attendance: [] }));
    lastSaudiResetDate = currentSaudiDate;
    saveDatabase();
    generateDailySessionsForToday();
  }
}
if (!isVercel) {
  setInterval(checkAndTriggerSaudiMidnightReset, 3e4);
}
var sseClients = /* @__PURE__ */ new Set();
function broadcastSseEvent(eventPayload) {
  const data = `data: ${JSON.stringify(eventPayload)}

`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}
if (!isVercel) {
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(":\n\n");
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15e3);
}
var CLOUD_ATT_TOPIC = "zoom_att_badawi_live_v4_att";
var CLOUD_SES_TOPIC = "zoom_att_badawi_live_v4_ses";
var CLOUD_BASE_URL = "https://ntfy.sh";
var processedCloudMsgIds = /* @__PURE__ */ new Set();
var isPollingCloudRelay = false;
var lastCloudPollTimestamp = 0;
async function syncCloudRelayIntoServer(force = false) {
  const now = Date.now();
  if (isPollingCloudRelay) return;
  if (!force && now - lastCloudPollTimestamp < 1200) return;
  isPollingCloudRelay = true;
  lastCloudPollTimestamp = now;
  try {
    const [attRes, sesRes] = await Promise.allSettled([
      fetch(`${CLOUD_BASE_URL}/${CLOUD_ATT_TOPIC}/json?poll=1&since=12h`, { cache: "no-store" }).then(
        (r) => r.ok ? r.text() : ""
      ),
      fetch(`${CLOUD_BASE_URL}/${CLOUD_SES_TOPIC}/json?poll=1&since=12h`, { cache: "no-store" }).then(
        (r) => r.ok ? r.text() : ""
      )
    ]);
    let dbModified = false;
    const attText = attRes.status === "fulfilled" ? attRes.value : "";
    const sesText = sesRes.status === "fulfilled" ? sesRes.value : "";
    if (attText && attText.trim()) {
      const lines = attText.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const wrapper = JSON.parse(line.trim());
          if (!wrapper || wrapper.event !== "message" || !wrapper.message) continue;
          if (wrapper.id && processedCloudMsgIds.has(wrapper.id)) continue;
          if (wrapper.id) processedCloudMsgIds.add(wrapper.id);
          const payload = typeof wrapper.message === "string" ? JSON.parse(wrapper.message) : wrapper.message;
          if (!payload) continue;
          if ((payload.type === "ATTENDANCE_CHECKIN" || payload.type === "CHECKIN") && (payload.envelope || payload.record)) {
            const env = payload.envelope || payload;
            const rec = env.record;
            const targetSessionId = env.sessionId || rec?.sessionId;
            if (!rec || !targetSessionId || deletedSessionIds.has(targetSessionId)) continue;
            const targetClassId = env.classId;
            const targetClassName = env.className;
            const normTargetClassName = normalizeText2(targetClassName || "");
            let targetSession = db.sessions.find((s) => s.id === targetSessionId);
            if (!targetSession && !deletedSessionIds.has(targetSessionId)) {
              targetSession = {
                id: targetSessionId,
                teacherId: env.teacherId || "teacher_ahmed_badawi",
                classId: targetClassId || "class_auto",
                className: targetClassName || "\u0627\u0644\u0641\u0635\u0644",
                sessionTitle: env.sessionTitle || (targetClassName ? `\u062D\u0635\u0629 ${targetClassName}` : "\u062D\u0635\u0629 \u062F\u0631\u0627\u0633\u064A\u0629"),
                zoomUrl: env.zoomUrl || "https://zoom.us",
                targetTrack: env.targetTrack || "all",
                createdAt: rec.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
                scheduledTime: "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646",
                isActive: true,
                attendance: []
              };
              db.sessions.unshift(targetSession);
              dbModified = true;
            }
            if (targetSession) {
              const prevLength = (targetSession.attendance || []).length;
              targetSession.attendance = mergeAttendanceRecordsList(
                targetSession.attendance || [],
                [rec],
                targetSession.lastAttendanceResetAt
              );
              const newLength = targetSession.attendance.length;
              if (newLength !== prevLength || targetSession.attendance[0]?.lastJoinedAt === rec.lastJoinedAt) {
                dbModified = true;
                broadcastSseEvent({
                  type: "ATTENDANCE_RECORDED",
                  sessionId: targetSession.id,
                  classId: targetSession.classId,
                  className: targetSession.className,
                  record: rec,
                  session: targetSession,
                  sessions: db.sessions,
                  lastUpdatedAt: Date.now(),
                  db
                });
              }
            }
          } else if (payload.type === "ATTENDANCE_RESET" && payload.resetAt) {
            let resetAny = false;
            for (const s of db.sessions) {
              if (!payload.teacherId || s.teacherId === payload.teacherId) {
                s.attendance = [];
                s.lastAttendanceResetAt = payload.resetAt;
                resetAny = true;
              }
            }
            if (resetAny) {
              dbModified = true;
            }
          }
        } catch {
        }
      }
    }
    if (sesText && sesText.trim()) {
      const lines = sesText.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const wrapper = JSON.parse(line.trim());
          if (!wrapper || wrapper.event !== "message" || !wrapper.message) continue;
          if (wrapper.id && processedCloudMsgIds.has(wrapper.id)) continue;
          if (wrapper.id) processedCloudMsgIds.add(wrapper.id);
          const payload = typeof wrapper.message === "string" ? JSON.parse(wrapper.message) : wrapper.message;
          if (!payload) continue;
          if (payload.type === "SESSION_DELETED" && payload.sessionId) {
            deletedSessionIds.add(payload.sessionId);
            const prevLen = db.sessions.length;
            db.sessions = db.sessions.filter((s) => s.id !== payload.sessionId);
            if (db.sessions.length !== prevLen) dbModified = true;
          } else if (payload.type === "SESSIONS_BATCH_DELETED" && Array.isArray(payload.sessionIds)) {
            payload.sessionIds.forEach((id) => id && deletedSessionIds.add(id));
            const idSet = new Set(payload.sessionIds);
            const prevLen = db.sessions.length;
            db.sessions = db.sessions.filter((s) => !idSet.has(s.id));
            if (db.sessions.length !== prevLen) dbModified = true;
          } else if (payload.type === "SESSION_UPSERT" && payload.session && payload.session.id) {
            const inc = payload.session;
            if (deletedSessionIds.has(inc.id)) continue;
            const existingIdx = db.sessions.findIndex((s) => s.id === inc.id);
            if (existingIdx >= 0) {
              const prev = db.sessions[existingIdx];
              db.sessions[existingIdx] = {
                ...prev,
                ...inc,
                attendance: mergeAttendanceRecordsList(
                  prev.attendance || [],
                  inc.attendance || [],
                  inc.lastAttendanceResetAt || prev.lastAttendanceResetAt
                )
              };
            } else {
              db.sessions.unshift({
                ...inc,
                attendance: inc.attendance || []
              });
            }
            dbModified = true;
          }
        } catch {
        }
      }
    }
    if (dbModified) {
      saveDatabase();
    }
  } catch (err) {
  } finally {
    isPollingCloudRelay = false;
  }
}
syncCloudRelayIntoServer(true).catch(() => {
});
if (!isVercel) {
  setInterval(() => {
    syncCloudRelayIntoServer().catch(() => {
    });
  }, 2500);
}
function getSaudiDayOfWeek(date = /* @__PURE__ */ new Date()) {
  const saudiTime = new Date(date.getTime() + (3 * 60 + date.getTimezoneOffset()) * 6e4);
  const dayIndex = saudiTime.getDay();
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[dayIndex];
}
function normalizeDayOfWeekKey(dayStr) {
  if (!dayStr) return "";
  const d = dayStr.trim().toLowerCase();
  if (d.includes("sun") || d.includes("\u0623\u062D\u062F") || d.includes("\u0627\u062D\u062F")) return "sunday";
  if (d.includes("mon") || d.includes("\u0625\u062B\u0646\u064A\u0646") || d.includes("\u0627\u062B\u0646\u0627\u0646") || d.includes("\u0627\u062B\u0646\u064A\u0646")) return "monday";
  if (d.includes("tue") || d.includes("\u062B\u0644\u0627\u062B\u0627\u0621")) return "tuesday";
  if (d.includes("wed") || d.includes("\u0623\u0631\u0628\u0639\u0627\u0621") || d.includes("\u0627\u0631\u0628\u0639\u0627\u0621")) return "wednesday";
  if (d.includes("thu") || d.includes("\u062E\u0645\u064A\u0633")) return "thursday";
  if (d.includes("fri") || d.includes("\u062C\u0645\u0639\u0629")) return "friday";
  if (d.includes("sat") || d.includes("\u0633\u0628\u062A")) return "saturday";
  return d;
}
function generateDailySessionsForToday() {
  const todayDay = getSaudiDayOfWeek();
  const todayDateStr = getSaudiDateString();
  const createdSessions = [];
  let updatedExisting = false;
  for (const teacher of db.teachers) {
    let todaysPeriods = [];
    if (teacher.weeklySchedule && Array.isArray(teacher.weeklySchedule) && teacher.weeklySchedule.length > 0) {
      todaysPeriods = teacher.weeklySchedule.filter(
        (p) => normalizeDayOfWeekKey(p.dayOfWeek) === todayDay
      );
    }
    if (todaysPeriods.length === 0) {
      const teacherClasses = db.classes.filter(
        (c) => !teacher.assignedClassIds || teacher.assignedClassIds.length === 0 || teacher.assignedClassIds.includes(c.id)
      );
      const classesToUse = teacherClasses.length > 0 ? teacherClasses : db.classes;
      const defaultTimes = ["08:00", "08:40", "09:20", "10:00", "10:45", "11:25", "12:05", "12:45"];
      todaysPeriods = classesToUse.map((c, idx) => ({
        id: `auto_period_${c.id}`,
        dayOfWeek: todayDay,
        dayNameArabic: "",
        className: c.name,
        classId: c.id,
        startTime: defaultTimes[idx % defaultTimes.length],
        endTime: "",
        subject: teacher.subject ? `\u062D\u0635\u0629 ${teacher.subject}` : `\u062D\u0635\u0629 ${c.name}`,
        targetTrack: "all",
        zoomUrl: teacher.classZoomLinks && teacher.classZoomLinks[c.id] || c.zoomUrl || teacher.defaultZoomLink || ""
      }));
    }
    for (const period of todaysPeriods) {
      const matchedClass = db.classes.find(
        (c) => period.classId && c.id === period.classId || normalizeText2(c.name) === normalizeText2(period.className) || c.name.toLowerCase().includes(period.className.toLowerCase())
      );
      const classId = matchedClass?.id || period.classId || `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const className = matchedClass?.name || period.className;
      const teacherClassZoom = (teacher.classZoomLinks && classId && teacher.classZoomLinks[classId] !== void 0 ? teacher.classZoomLinks[classId] : void 0) ?? (teacher.classZoomLinks && matchedClass?.id && teacher.classZoomLinks[matchedClass.id] !== void 0 ? teacher.classZoomLinks[matchedClass.id] : void 0);
      const zoomUrl = period.zoomUrl || (teacherClassZoom !== void 0 ? teacherClassZoom : matchedClass?.zoomUrl || teacher.defaultZoomLink || "");
      const cleanTime = (period.startTime || "0800").replace(/[^0-9A-Za-z]/g, "");
      const detSessionId = `ses_auto_${todayDateStr}_${teacher.id}_${classId}_${cleanTime}`;
      deletedSessionIds.delete(detSessionId);
      const existingSession = db.sessions.find(
        (s) => s.id === detSessionId || s.teacherId === teacher.id && s.classId === classId && s.scheduledTime === period.startTime && s.isActive
      );
      if (existingSession) {
        const nextTrack = period.targetTrack || "all";
        const nextTitle = period.subject || existingSession.sessionTitle || `\u062D\u0635\u0629 ${className}`;
        const nextZoom = zoomUrl || existingSession.zoomUrl;
        if (existingSession.targetTrack !== nextTrack || existingSession.sessionTitle !== nextTitle || existingSession.scheduledTime !== period.startTime || nextZoom && existingSession.zoomUrl !== nextZoom) {
          existingSession.targetTrack = nextTrack;
          existingSession.sessionTitle = nextTitle;
          existingSession.scheduledTime = period.startTime;
          if (nextZoom) existingSession.zoomUrl = nextZoom;
          updatedExisting = true;
        }
      } else {
        const normClassName = normalizeText2(className || "");
        for (const oldSes of db.sessions) {
          if (oldSes.isActive && (classId && classId !== "class_auto" && oldSes.classId === classId || normClassName && normalizeText2(oldSes.className || "") === normClassName)) {
            oldSes.isActive = false;
          }
        }
        const newSession = {
          id: detSessionId,
          teacherId: teacher.id,
          classId,
          className,
          sessionTitle: period.subject || `\u062D\u0635\u0629 ${className}`,
          zoomUrl,
          targetTrack: period.targetTrack || "all",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          scheduledTime: period.startTime,
          isActive: true,
          autoGenerated: true,
          attendance: [],
          whatsappReminderSent: false
        };
        db.sessions.unshift(newSession);
        createdSessions.push(newSession);
      }
    }
  }
  saveDatabase();
  broadcastSseEvent({
    type: "DAILY_SESSIONS_GENERATED",
    count: createdSessions.length,
    sessions: db.sessions,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  console.log(`[Auto Schedule] Synchronized daily sessions for today (${todayDay}, ${todayDateStr}): ${createdSessions.length} created, updated=${updatedExisting}. Total sessions=${db.sessions.length}`);
  return createdSessions;
}
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toLowerCase();
  if (trimmed === "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646" || trimmed === "\u0645\u0628\u0627\u0634\u0631" || trimmed === "\u0627\u0644\u0622\u0646" || trimmed === "now") {
    const now = /* @__PURE__ */ new Date();
    const saudiNow = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 6e4);
    return saudiNow.getHours() * 60 + saudiNow.getMinutes();
  }
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      const saudiTime = new Date(d.getTime() + (3 * 60 + d.getTimezoneOffset()) * 6e4);
      return saudiTime.getHours() * 60 + saudiTime.getMinutes();
    }
  }
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm|ص|م)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = (match[3] || "").toLowerCase();
  if ((ampm === "pm" || ampm === "\u0645") && hours < 12) hours += 12;
  if ((ampm === "am" || ampm === "\u0635") && hours === 12) hours = 0;
  return hours * 60 + minutes;
}
async function dispatchWhatsAppCloudMessage(recipient, message, className = "\u062D\u0635\u0629 \u062F\u0631\u0627\u0633\u064A\u0629", teacherId) {
  let sessionConfig = db.whatsappSession || {};
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher && teacher.whatsappConfig) {
      sessionConfig = { ...sessionConfig, ...teacher.whatsappConfig };
    }
  }
  const hasGreenApi = Boolean(sessionConfig.greenApiInstanceId?.trim() && sessionConfig.greenApiToken?.trim());
  const hasUltraMsg = Boolean(sessionConfig.ultraMsgInstanceId?.trim() && sessionConfig.ultraMsgToken?.trim());
  const hasMeta = Boolean(sessionConfig.metaPhoneNumberId?.trim() && sessionConfig.metaAccessToken?.trim());
  const hasWebhook = Boolean(sessionConfig.webhookUrl?.trim());
  let effectiveProvider = sessionConfig.provider || "direct";
  if (effectiveProvider === "green_api" && !hasGreenApi) {
    if (hasUltraMsg) effectiveProvider = "ultramsg";
    else if (hasMeta) effectiveProvider = "meta_cloud";
    else if (hasWebhook) effectiveProvider = "webhook";
  } else if (effectiveProvider === "ultramsg" && !hasUltraMsg) {
    if (hasGreenApi) effectiveProvider = "green_api";
    else if (hasMeta) effectiveProvider = "meta_cloud";
    else if (hasWebhook) effectiveProvider = "webhook";
  } else if (effectiveProvider === "direct") {
    if (hasUltraMsg) effectiveProvider = "ultramsg";
    else if (hasGreenApi) effectiveProvider = "green_api";
    else if (hasMeta) effectiveProvider = "meta_cloud";
    else if (hasWebhook) effectiveProvider = "webhook";
  }
  if (effectiveProvider === "ultramsg" && hasUltraMsg) {
    try {
      const instanceId = String(sessionConfig.ultraMsgInstanceId).trim();
      const token = String(sessionConfig.ultraMsgToken).trim();
      const rawTo = String(recipient || "").trim();
      let cleanTo = "";
      if (rawTo.includes("@g.us") || rawTo.includes("@c.us")) {
        const match = rawTo.match(/([0-9A-Za-z\-_]+@(g|c)\.us)/);
        cleanTo = match ? match[1] : rawTo;
      } else if (rawTo.startsWith("1203") && !rawTo.includes("@")) {
        cleanTo = `${rawTo}@g.us`;
      } else if (rawTo.includes("chat.whatsapp.com")) {
        let resolvedChatId = "";
        const inviteCode = rawTo.split("chat.whatsapp.com/")[1]?.split(/[\?\/#]/)[0]?.trim();
        if (sessionConfig.greenApiInstanceId && sessionConfig.greenApiToken && inviteCode) {
          try {
            const gDataUrl = `https://api.green-api.com/waInstance${sessionConfig.greenApiInstanceId.trim()}/getGroupDataByInviteCode/${sessionConfig.greenApiToken.trim()}`;
            const gRes = await fetch(gDataUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inviteCode })
            });
            const gJson = await gRes.json().catch(() => ({}));
            if (gJson && (gJson.chatId || gJson.id)) {
              resolvedChatId = gJson.chatId || gJson.id;
            }
          } catch {
          }
        }
        if (resolvedChatId && resolvedChatId.endsWith("@g.us")) {
          cleanTo = resolvedChatId;
        } else {
          return {
            success: false,
            providerUsed: "ultramsg",
            error: `\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 Green-API \u0643\u0646\u0648\u0639 \u0645\u0632\u0648\u062F \u0623\u0648 \u0643\u062A\u0627\u0628\u0629 \u0645\u0639\u0631\u0641 \u0627\u0644\u062C\u0631\u0648\u0628 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 (Group ID \u0645\u062B\u0644 120363xxx@g.us) \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0641\u0635\u0644 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u062C\u0631\u0648\u0628`
          };
        }
      } else {
        const digits = rawTo.replace(/[^0-9]/g, "");
        if (digits) {
          if (digits.startsWith("05") && digits.length === 10) cleanTo = `966${digits.substring(1)}`;
          else if (digits.startsWith("01") && digits.length === 11) cleanTo = `20${digits.substring(1)}`;
          else cleanTo = digits;
        }
      }
      if (!cleanTo) {
        return {
          success: false,
          providerUsed: "ultramsg",
          error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644 \u0623\u0648 \u0645\u0639\u0631\u0641 \u0627\u0644\u062C\u0631\u0648\u0628 (Group ID \u0645\u062B\u0644 120363xxx@g.us) \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0641\u0635\u0644 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u0627\u0644\u062A\u0633\u0645\u064A\u0627\u062A \u0627\u0644\u0645\u0641\u0631\u063A\u0629"
        };
      }
      const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token,
          to: cleanTo,
          body: message
        })
      });
      const data = await response.json().catch(() => ({}));
      if (data?.sent === "true" || data?.id) {
        return {
          success: true,
          providerUsed: "ultramsg",
          responseDetails: `UltraMsg MessageId: ${data.id}`
        };
      } else {
        const errorDetails = typeof data?.message === "string" ? data.message : data?.error ? JSON.stringify(data.error) : "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 UltraMsg";
        return { success: false, providerUsed: "ultramsg", error: errorDetails };
      }
    } catch (err) {
      return { success: false, providerUsed: "ultramsg", error: err.message || "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u0627\u062F\u0645 UltraMsg" };
    }
  }
  if (effectiveProvider === "green_api" && hasGreenApi) {
    try {
      const cleanInstance = String(sessionConfig.greenApiInstanceId).trim();
      const cleanToken = String(sessionConfig.greenApiToken).trim();
      let chatId = String(recipient || "").trim();
      if (chatId.includes("@g.us") || chatId.includes("@c.us")) {
        const match = chatId.match(/([0-9A-Za-z\-_]+@(g|c)\.us)/);
        chatId = match ? match[1] : chatId;
      } else if (chatId.startsWith("1203") && !chatId.includes("@")) {
        chatId = `${chatId}@g.us`;
      } else if (chatId.includes("chat.whatsapp.com")) {
        const inviteMatch = chatId.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
        const inviteCode = inviteMatch ? inviteMatch[1].trim() : "";
        let fullInviteLink = chatId;
        if (!fullInviteLink.startsWith("http://") && !fullInviteLink.startsWith("https://")) {
          fullInviteLink = `https://${fullInviteLink}`;
        }
        let resolvedChatId = "";
        if (inviteCode) {
          try {
            const gDataUrl = `https://api.green-api.com/waInstance${cleanInstance}/getGroupDataByInviteCode/${cleanToken}`;
            const gRes = await fetch(gDataUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ groupId: inviteCode, inviteCode, groupInviteCode: inviteCode })
            });
            const gJson = await gRes.json().catch(() => ({}));
            const foundId = gJson?.chatId || gJson?.id || gJson?.groupId || gJson?.groupData?.id || gJson?.groupData?.chatId;
            if (foundId && (foundId.endsWith("@g.us") || foundId.endsWith("@c.us"))) {
              resolvedChatId = foundId;
            }
          } catch (e) {
            console.warn("[Green-API] getGroupDataByInviteCode error:", e);
          }
        }
        if (!resolvedChatId && (fullInviteLink || inviteCode)) {
          try {
            const joinUrl = `https://api.green-api.com/waInstance${cleanInstance}/joinGroup/${cleanToken}`;
            const joinRes = await fetch(joinUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inviteLink: fullInviteLink, groupId: inviteCode, groupInviteCode: inviteCode })
            });
            const joinJson = await joinRes.json().catch(() => ({}));
            const foundFromJoin = joinJson?.chatId || joinJson?.id || joinJson?.groupId;
            if (foundFromJoin && (foundFromJoin.endsWith("@g.us") || foundFromJoin.endsWith("@c.us"))) {
              resolvedChatId = foundFromJoin;
            }
          } catch (e) {
            console.warn("[Green-API] joinGroup error:", e);
          }
        }
        if (resolvedChatId && (resolvedChatId.endsWith("@g.us") || resolvedChatId.endsWith("@c.us"))) {
          chatId = resolvedChatId;
        } else {
          console.log(`[Green-API Group Notice] Could not resolve group ID for ${recipient} via API. Falling back to direct WhatsApp opening.`);
          return {
            success: true,
            providerUsed: "direct",
            responseDetails: `\u0631\u0627\u0628\u0637 \u0627\u0644\u062C\u0631\u0648\u0628 (${recipient}) \u0645\u0633\u062C\u0644 \u0648\u0645\u062D\u0641\u0648\u0638 \u0628\u0627\u0644\u0646\u0638\u0627\u0645. \u062A\u0645 \u0646\u0633\u062E \u0646\u0635 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u0644\u0644\u062D\u0627\u0641\u0638\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B!`
          };
        }
      } else {
        let digits = chatId.replace(/[^0-9]/g, "");
        if (digits.startsWith("00")) digits = digits.substring(2);
        if (digits.startsWith("05") && digits.length === 10) digits = `966${digits.substring(1)}`;
        else if (digits.startsWith("01") && digits.length === 11) digits = `20${digits.substring(1)}`;
        if (!digits) {
          return { success: false, providerUsed: "green_api", error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
        }
        chatId = `${digits}@c.us`;
      }
      const url = `https://api.green-api.com/waInstance${cleanInstance}/sendMessage/${cleanToken}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          message
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.idMessage) {
        return {
          success: true,
          providerUsed: "green_api",
          responseDetails: `Green-API idMessage: ${data.idMessage}`
        };
      } else {
        const errorMsg = data?.message || `Green-API \u0641\u0634\u0644 \u0628\u0631\u0645\u0632 (${response.status})`;
        return { success: false, providerUsed: "green_api", error: errorMsg };
      }
    } catch (err) {
      return { success: false, providerUsed: "green_api", error: err.message || "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u0627\u062F\u0645 Green-API" };
    }
  }
  if (effectiveProvider === "meta_cloud" && hasMeta) {
    try {
      const phoneId = String(sessionConfig.metaPhoneNumberId).trim();
      const token = String(sessionConfig.metaAccessToken).trim();
      const cleanTo = String(recipient || "").replace(/[^0-9]/g, "");
      const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanTo,
          type: "text",
          text: { body: message }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.messages) {
        return {
          success: true,
          providerUsed: "meta_cloud",
          responseDetails: `Meta Cloud Msg: ${data.messages[0]?.id}`
        };
      } else {
        return {
          success: false,
          providerUsed: "meta_cloud",
          error: data?.error?.message || `Meta API Error (${response.status})`
        };
      }
    } catch (err) {
      return { success: false, providerUsed: "meta_cloud", error: err.message || "\u062E\u0637\u0623 \u0641\u064A Meta Cloud API" };
    }
  }
  if (effectiveProvider === "webhook" && hasWebhook) {
    try {
      const response = await fetch(sessionConfig.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient,
          to: String(recipient || "").replace(/[^0-9]/g, ""),
          message,
          className,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "zoom_attendance_reminder"
        })
      });
      if (response.ok) {
        return {
          success: true,
          providerUsed: "webhook",
          responseDetails: `Webhook HTTP ${response.status}`
        };
      } else {
        return {
          success: false,
          providerUsed: "webhook",
          error: `Webhook returned status code ${response.status}`
        };
      }
    } catch (err) {
      return { success: false, providerUsed: "webhook", error: err.message || "\u0641\u0634\u0644 \u0627\u0633\u062A\u062F\u0639\u0627\u0621 Webhook" };
    }
  }
  return {
    success: true,
    providerUsed: "direct",
    responseDetails: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u0628\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0628\u0646\u062C\u0627\u062D"
  };
}
async function checkAndSendUpcomingReminders() {
  if (db.whatsappSession && db.whatsappSession.autoRemindEnabled === false) {
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const saudiNow = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 6e4);
  const currentMinutes = saudiNow.getHours() * 60 + saudiNow.getMinutes();
  const todayDateStr = getSaudiDateString(now);
  const rawPublished = db.publishedDomain || process.env.APP_URL || "";
  const appBaseUrl = rawPublished && !rawPublished.includes("ais-pre-") && !rawPublished.includes("ais-dev-") ? rawPublished.replace(/\/+$/, "") : "https://zoom2000.vercel.app";
  for (const session of db.sessions) {
    if (!session.isActive || session.whatsappReminderSent || !session.scheduledTime) {
      continue;
    }
    if (session.createdAt) {
      try {
        const createdDate = new Date(session.createdAt);
        if (!isNaN(createdDate.getTime())) {
          const sessionSaudiDate = getSaudiDateString(createdDate);
          if (sessionSaudiDate !== todayDateStr) {
            continue;
          }
        }
      } catch {
      }
    }
    const sessionMinutes = parseTimeToMinutes(session.scheduledTime);
    if (sessionMinutes === null) continue;
    const diffMinutes = sessionMinutes - currentMinutes;
    const targetMinutes = typeof db.whatsappSession?.reminderMinutesBefore === "number" ? db.whatsappSession.reminderMinutesBefore : 5;
    const isDue = diffMinutes <= targetMinutes && diffMinutes >= -60;
    if (isDue) {
      const schoolClass = db.classes.find(
        (c) => c.id === session.classId || c.name === session.className || normalizeText2(c.name) === normalizeText2(session.className) || c.name.toLowerCase().replace(/[\s\-_]+/g, "") === session.className.toLowerCase().replace(/[\s\-_]+/g, "") || c.name.toLowerCase().includes(session.className.toLowerCase()) || session.className.toLowerCase().includes(c.name.toLowerCase())
      );
      const teacher = db.teachers.find((t) => t.id === session.teacherId) || db.teachers[0];
      const recipients = getClassWhatsAppRecipients(schoolClass, teacher);
      if (recipients.length === 0) {
        session.whatsappReminderSent = true;
        saveDatabase();
        broadcastSseEvent({
          type: "SESSION_CREATED_OR_UPDATED",
          originTeacherId: session.teacherId,
          session,
          lastUpdatedAt: db.lastUpdatedAt,
          db
        });
        continue;
      }
      const effectiveCustomTemplate = teacher?.whatsappConfig?.customMessageTemplate && teacher.whatsappConfig.customMessageTemplate.trim() || db.whatsappSession?.customMessageTemplate && db.whatsappSession.customMessageTemplate.trim() || void 0;
      const reminderMessage = buildWhatsAppReminderMessage({
        session,
        schoolClass,
        teacher,
        appUrl: appBaseUrl,
        customTemplate: effectiveCustomTemplate,
        minutesBefore: targetMinutes
      });
      for (const targetRec of recipients) {
        const dispatchRes = await dispatchWhatsAppCloudMessage(targetRec.recipient, reminderMessage, session.className, teacher?.id);
        const logEntry = {
          id: `walog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sessionId: session.id,
          className: session.className,
          recipient: targetRec.recipient,
          recipientType: targetRec.recipientType,
          sentAt: (/* @__PURE__ */ new Date()).toISOString(),
          status: dispatchRes.success ? "sent" : "failed",
          messagePreview: reminderMessage.substring(0, 180) + "...",
          triggerType: "auto_5min"
        };
        if (!Array.isArray(db.whatsappLogs)) {
          db.whatsappLogs = [];
        }
        db.whatsappLogs.unshift(logEntry);
        console.log(`[WhatsApp Background Daemon] Auto reminder sent via ${dispatchRes.providerUsed} (${logEntry.status}) for ${session.className} to ${targetRec.recipient}`);
        broadcastSseEvent({
          type: "WHATSAPP_REMINDER_SENT",
          sessionId: session.id,
          className: session.className,
          recipient: targetRec.recipient,
          scheduledTime: session.scheduledTime,
          message: reminderMessage,
          log: logEntry,
          providerResult: dispatchRes,
          db
        });
      }
      session.whatsappReminderSent = true;
      session.reminderSentAt = (/* @__PURE__ */ new Date()).toISOString();
      saveDatabase();
    }
  }
}
if (!isVercel) {
  setInterval(() => {
    checkAndSendUpcomingReminders().catch((err) => {
      console.warn("[WhatsApp Daemon Error]:", err);
    });
  }, 1e4);
  generateDailySessionsForToday();
}
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now(), lastUpdatedAt: db.lastUpdatedAt, db })}

`);
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});
app.get("/api/health", (_req, res) => {
  checkAndTriggerSaudiMidnightReset();
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString(), saudiDate: getSaudiDateString(), lastUpdatedAt: db.lastUpdatedAt });
});
app.get("/api/data", async (_req, res) => {
  checkAndTriggerSaudiMidnightReset();
  await syncCloudRelayIntoServer().catch(() => {
  });
  db.students = enforceOfficialStudentTracks(db.students);
  res.json(db);
});
app.post("/api/sync", (req, res) => {
  checkAndTriggerSaudiMidnightReset();
  const { teachers, currentTeacherId, classes, students, sessions, publishedDomain, whatsappSession } = req.body;
  const syncingTeacherId = currentTeacherId || req.body.teacherId;
  if (typeof publishedDomain === "string" && publishedDomain.trim()) {
    db.publishedDomain = publishedDomain.trim();
  }
  if (whatsappSession && typeof whatsappSession === "object") {
    db.whatsappSession = {
      ...db.whatsappSession || {
        status: "connected",
        phoneNumber: "+966 50 123 4567",
        connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
        autoRemindEnabled: true,
        reminderMinutesBefore: 5
      },
      ...whatsappSession
    };
  }
  if (Array.isArray(classes) && classes.length > 0) {
    db.classes = classes;
  }
  if (Array.isArray(students) && students.length > 0) {
    db.students = enforceOfficialStudentTracks(students);
  }
  if (Array.isArray(teachers) && teachers.length > 0) {
    const badawi = teachers.find((t) => t.id === "teacher_ahmed_badawi" || (t.name || "").includes("\u0628\u062F\u0648\u064A")) || DEFAULT_TEACHERS[0];
    badawi.id = "teacher_ahmed_badawi";
    badawi.name = "\u0645\u0633\u062A\u0631 \u0627\u062D\u0645\u062F \u0628\u062F\u0648\u064A";
    badawi.subject = "\u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0627\u062A (Math)";
    db.teachers = [badawi];
  } else {
    db.teachers = DEFAULT_TEACHERS;
  }
  db.currentTeacherId = "teacher_ahmed_badawi";
  if (Array.isArray(db.classes) && db.classes.length > 0) {
    const autoMerge = mergeDuplicateClasses(db.classes, db.students, db.sessions);
    if (autoMerge.mergedCount > 0) {
      db.classes = autoMerge.classes;
      db.students = enforceOfficialStudentTracks(autoMerge.students);
      db.sessions = autoMerge.sessions;
    }
  }
  if (Array.isArray(sessions)) {
    const existingMap = new Map(db.sessions.map((s) => [s.id, s]));
    const incomingIds = new Set(sessions.map((s) => s.id));
    const preservedExistingSessions = db.sessions.filter(
      (s) => !incomingIds.has(s.id) && !deletedSessionIds.has(s.id)
    );
    const mergedIncoming = sessions.filter((incoming) => incoming && incoming.id && !deletedSessionIds.has(incoming.id)).map((incoming) => {
      const existing = existingMap.get(incoming.id);
      if (existing) {
        const effectiveResetAt = incoming.lastAttendanceResetAt && existing.lastAttendanceResetAt ? new Date(incoming.lastAttendanceResetAt) > new Date(existing.lastAttendanceResetAt) ? incoming.lastAttendanceResetAt : existing.lastAttendanceResetAt : incoming.lastAttendanceResetAt || existing.lastAttendanceResetAt;
        const mergedAttendance = mergeAttendanceRecordsList(
          existing.attendance || [],
          incoming.attendance || [],
          effectiveResetAt
        );
        return {
          ...existing,
          ...incoming,
          zoomUrl: incoming.zoomUrl !== void 0 ? incoming.zoomUrl : existing.zoomUrl,
          teacherId: incoming.teacherId || syncingTeacherId || existing.teacherId,
          whatsappReminderSent: Boolean(existing.whatsappReminderSent || incoming.whatsappReminderSent),
          reminderSentAt: existing.reminderSentAt || incoming.reminderSentAt,
          lastAttendanceResetAt: effectiveResetAt,
          attendance: mergedAttendance
        };
      }
      return {
        ...incoming,
        teacherId: incoming.teacherId || syncingTeacherId,
        attendance: mergeAttendanceRecordsList([], incoming.attendance || [], incoming.lastAttendanceResetAt)
      };
    });
    const combined = [...mergedIncoming, ...preservedExistingSessions];
    db.sessions = combined;
  }
  saveDatabase();
  broadcastSseEvent({
    type: "STATE_MUTATED",
    originTeacherId: syncingTeacherId,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({
    success: true,
    lastUpdatedAt: db.lastUpdatedAt,
    count: db.sessions.length,
    classesCount: db.classes.length,
    studentsCount: db.students.length,
    db
  });
});
app.get("/api/teacher-pin", (_req, res) => {
  res.json({ pin: db.teacherPin || "123654" });
});
app.post("/api/teacher-pin", (req, res) => {
  const { pin, teacherId } = req.body;
  const targetTeacher = db.teachers.find((t) => t.id === teacherId);
  const isAllowed = teacherId === "teacher_ahmed_badawi" || targetTeacher && (targetTeacher.email === "ahmedbadawi5090@gmail.com" || targetTeacher.name.includes("\u0628\u062F\u0648\u064A") || targetTeacher.name.includes("badawi"));
  if (!isAllowed) {
    res.status(403).json({
      error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0642\u062A\u0635\u0631\u0629 \u062D\u0635\u0631\u064A\u0627\u064B \u0639\u0644\u0649 \u0644\u0648\u062D\u0629 \u062A\u062D\u0643\u0645 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A"
    });
    return;
  }
  if (typeof pin === "string" && pin.trim().length >= 4) {
    db.teacherPin = pin.trim();
    saveDatabase();
    res.json({ success: true, pin: db.teacherPin });
  } else {
    res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 4 \u0623\u0631\u0642\u0627\u0645 \u0623\u0648 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
});
app.get("/api/sessions", async (_req, res) => {
  checkAndTriggerSaudiMidnightReset();
  await syncCloudRelayIntoServer().catch(() => {
  });
  res.json(db.sessions);
});
app.get("/api/sessions/:id", async (req, res) => {
  checkAndTriggerSaudiMidnightReset();
  await syncCloudRelayIntoServer().catch(() => {
  });
  const session = db.sessions.find((s) => s.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});
app.post("/api/sessions", (req, res) => {
  checkAndTriggerSaudiMidnightReset();
  const newSession = req.body;
  if (!newSession.id) {
    res.status(400).json({ error: "Session ID required" });
    return;
  }
  deletedSessionIds.delete(newSession.id);
  const existingIdx = db.sessions.findIndex((s) => s.id === newSession.id);
  let savedSession;
  if (existingIdx >= 0) {
    const existing = db.sessions[existingIdx];
    const effectiveResetAt = newSession.lastAttendanceResetAt || existing.lastAttendanceResetAt;
    const mergedAttendance = mergeAttendanceRecordsList(
      existing.attendance || [],
      newSession.attendance || [],
      effectiveResetAt
    );
    savedSession = {
      ...existing,
      ...newSession,
      whatsappReminderSent: Boolean(existing.whatsappReminderSent || newSession.whatsappReminderSent),
      lastAttendanceResetAt: effectiveResetAt,
      attendance: mergedAttendance
    };
    db.sessions[existingIdx] = savedSession;
  } else {
    savedSession = {
      ...newSession,
      attendance: mergeAttendanceRecordsList([], newSession.attendance || [])
    };
    db.sessions.unshift(savedSession);
  }
  saveDatabase();
  broadcastSseEvent({
    type: "SESSION_CREATED_OR_UPDATED",
    originTeacherId: savedSession.teacherId,
    session: savedSession,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({ success: true, session: savedSession, lastUpdatedAt: db.lastUpdatedAt });
});
app.delete("/api/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  deletedSessionIds.add(sessionId);
  const targetSession = db.sessions.find((s) => s.id === sessionId);
  const originTeacherId = targetSession?.teacherId;
  db.sessions = db.sessions.filter((s) => s.id !== sessionId);
  saveDatabase();
  fetch("https://ntfy.sh/zoom_att_badawi_live_v4_ses", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      type: "SESSION_DELETED",
      sessionId,
      originTeacherId,
      updatedAt: Date.now()
    })
  }).catch(() => {
  });
  broadcastSseEvent({
    type: "SESSION_DELETED",
    sessionId,
    originTeacherId,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({ success: true, lastUpdatedAt: db.lastUpdatedAt });
});
app.post("/api/sessions/batch-delete", (req, res) => {
  const { sessionIds, teacherId } = req.body;
  if (Array.isArray(sessionIds) && sessionIds.length > 0) {
    sessionIds.forEach((id) => deletedSessionIds.add(id));
    const idSet = new Set(sessionIds);
    db.sessions = db.sessions.filter((s) => !idSet.has(s.id));
    saveDatabase();
    fetch("https://ntfy.sh/zoom_att_badawi_live_v4_ses", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        type: "SESSIONS_BATCH_DELETED",
        sessionIds,
        originTeacherId: teacherId,
        updatedAt: Date.now()
      })
    }).catch(() => {
    });
    broadcastSseEvent({
      type: "SESSIONS_BATCH_DELETED",
      sessionIds,
      originTeacherId: teacherId,
      lastUpdatedAt: db.lastUpdatedAt,
      db
    });
  }
  res.json({ success: true, remaining: db.sessions.length, lastUpdatedAt: db.lastUpdatedAt });
});
app.post("/api/attendance/reset", (req, res) => {
  const { teacherId } = req.body;
  const resetAt = (/* @__PURE__ */ new Date()).toISOString();
  db.sessions = db.sessions.map((s) => {
    if (!teacherId || s.teacherId === teacherId) {
      return { ...s, attendance: [], lastAttendanceResetAt: resetAt };
    }
    return s;
  });
  saveDatabase();
  fetch("https://ntfy.sh/zoom_att_badawi_live_v4_att", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      type: "ATTENDANCE_RESET",
      teacherId,
      resetAt,
      updatedAt: Date.now()
    })
  }).catch(() => {
  });
  broadcastSseEvent({
    type: "ATTENDANCE_RESET",
    teacherId,
    resetAt,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({ success: true, resetAt, lastUpdatedAt: db.lastUpdatedAt, message: "Attendance reset completed" });
});
app.delete("/api/classes/:id", (req, res) => {
  const classId = req.params.id;
  db.classes = db.classes.filter((c) => c.id !== classId);
  db.students = db.students.filter((s) => s.classId !== classId);
  db.sessions = db.sessions.filter((s) => s.classId !== classId);
  db.teachers = db.teachers.map((t) => ({
    ...t,
    assignedClassIds: Array.isArray(t.assignedClassIds) ? t.assignedClassIds.filter((cid) => cid !== classId) : []
  }));
  saveDatabase();
  broadcastSseEvent({
    type: "CLASS_DELETED",
    classId,
    db
  });
  res.json({ success: true, classId, remainingClasses: db.classes.length });
});
app.post("/api/classes/batch-delete", (req, res) => {
  const { classIds } = req.body;
  if (Array.isArray(classIds) && classIds.length > 0) {
    const idSet = new Set(classIds);
    db.classes = db.classes.filter((c) => !idSet.has(c.id));
    db.students = db.students.filter((s) => !idSet.has(s.classId));
    db.sessions = db.sessions.filter((s) => !idSet.has(s.classId));
    db.teachers = db.teachers.map((t) => ({
      ...t,
      assignedClassIds: Array.isArray(t.assignedClassIds) ? t.assignedClassIds.filter((cid) => !idSet.has(cid)) : []
    }));
    saveDatabase();
    broadcastSseEvent({
      type: "CLASSES_BATCH_DELETED",
      classIds,
      db
    });
  }
  res.json({ success: true, remaining: db.classes.length });
});
app.post("/api/classes/merge-duplicates", (_req, res) => {
  const result = mergeDuplicateClasses(db.classes, db.students, db.sessions);
  if (result.mergedCount > 0) {
    db.classes = result.classes;
    db.students = result.students;
    db.sessions = result.sessions;
    saveDatabase();
    broadcastSseEvent({
      type: "CLASSES_MERGED",
      mergedCount: result.mergedCount,
      classes: db.classes,
      students: db.students,
      sessions: db.sessions,
      db
    });
  }
  res.json({
    success: true,
    mergedCount: result.mergedCount,
    classes: db.classes,
    students: db.students,
    sessions: db.sessions
  });
});
app.delete("/api/students/:id", (req, res) => {
  const studentId = req.params.id;
  db.students = db.students.filter((s) => s.id !== studentId);
  saveDatabase();
  broadcastSseEvent({
    type: "STUDENT_DELETED",
    studentId,
    db
  });
  res.json({ success: true, studentId, remainingStudents: db.students.length });
});
app.post("/api/students/batch-delete", (req, res) => {
  const { studentIds } = req.body;
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    const idSet = new Set(studentIds);
    db.students = db.students.filter((s) => !idSet.has(s.id));
    saveDatabase();
    broadcastSseEvent({
      type: "STUDENTS_BATCH_DELETED",
      studentIds,
      db
    });
  }
  res.json({ success: true, remaining: db.students.length });
});
app.post("/api/students/batch-update", (req, res) => {
  const { studentIds, track, classId } = req.body;
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    const idSet = new Set(studentIds);
    db.students = db.students.map((st) => {
      if (idSet.has(st.id)) {
        return {
          ...st,
          track: track !== void 0 ? track : st.track,
          classId: classId !== void 0 ? classId : st.classId
        };
      }
      return st;
    });
    saveDatabase();
    broadcastSseEvent({
      type: "STUDENTS_BATCH_UPDATED",
      studentIds,
      track,
      classId,
      db
    });
  }
  res.json({ success: true, updatedCount: studentIds?.length || 0 });
});
app.post("/api/sessions/:id/attendance", (req, res) => {
  const sessionId = req.params.id;
  const { studentName, matchedStudent, confidenceScore } = req.body;
  if (!studentName || !studentName.trim()) {
    res.status(400).json({ error: "Student name is required" });
    return;
  }
  const rawInfo = req.body.sessionInfo || req.body;
  const targetClassId = rawInfo.classId;
  const targetClassName = rawInfo.className;
  const rawTeacherId = rawInfo.teacherId || db.currentTeacherId;
  const targetTeacherId = !rawTeacherId || rawTeacherId === "teacher_guest" ? "teacher_ahmed_badawi" : rawTeacherId;
  const targetZoomUrl = rawInfo.zoomUrl || "https://zoom.us";
  const targetTitle = rawInfo.sessionTitle || (targetClassName ? `\u062D\u0635\u0629 ${targetClassName}` : "\u062D\u0635\u0629 \u062F\u0631\u0627\u0633\u064A\u0629");
  const targetTrack = rawInfo.targetTrack || "all";
  let session = db.sessions.find((s) => s.id === sessionId);
  if (!session && (targetClassId || targetClassName)) {
    session = db.sessions.find(
      (s) => s.isActive && (targetClassId && s.classId === targetClassId || targetClassName && (s.className === targetClassName || normalizeText2(s.className) === normalizeText2(targetClassName)))
    );
  }
  if (!session) {
    session = {
      id: sessionId,
      teacherId: targetTeacherId,
      classId: targetClassId || "class_auto",
      className: targetClassName || "\u0627\u0644\u0641\u0635\u0644",
      sessionTitle: targetTitle,
      zoomUrl: targetZoomUrl,
      targetTrack,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      scheduledTime: rawInfo.scheduledTime || "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646",
      isActive: true,
      attendance: []
    };
    db.sessions.unshift(session);
    saveDatabase();
    broadcastSseEvent({
      type: "SESSION_CREATED_OR_UPDATED",
      originTeacherId: session.teacherId,
      session,
      db
    });
  }
  let finalMatched = matchedStudent;
  let finalConfidence = confidenceScore ?? 1;
  if (!finalMatched && Array.isArray(db.students) && db.students.length > 0) {
    const classStudents = db.students.filter((s) => s.classId === session?.classId);
    const candidateList = classStudents.length > 0 ? classStudents : db.students;
    const bestMatch = findBestMatch(studentName, candidateList, 0.75);
    if (bestMatch) {
      finalMatched = bestMatch.item;
      finalConfidence = bestMatch.score;
    }
  }
  const record = {
    id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sessionId,
    studentId: finalMatched?.id,
    studentName: studentName.trim(),
    matchedRosterName: finalMatched?.name,
    track: finalMatched?.track,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status: finalMatched ? "present" : "guest",
    confidenceScore: finalConfidence
  };
  const normInput = normalizeText2(studentName);
  const normMatched = finalMatched?.name ? normalizeText2(finalMatched.name) : "";
  const existingIndex = session.attendance.findIndex((rec) => {
    if (finalMatched?.id && rec.studentId && rec.studentId === finalMatched.id) return true;
    if (finalMatched?.id && rec.studentId === finalMatched.id) return true;
    if (normMatched && rec.matchedRosterName && normalizeText2(rec.matchedRosterName) === normMatched) return true;
    const normRec = normalizeText2(rec.studentName);
    const normRoster = rec.matchedRosterName ? normalizeText2(rec.matchedRosterName) : "";
    if (normInput === normRec || normRoster && normInput === normRoster) return true;
    if (normMatched && (normMatched === normRec || normMatched === normRoster)) return true;
    return false;
  });
  let savedRecord;
  let isReentry = false;
  if (existingIndex >= 0) {
    isReentry = true;
    const existing = session.attendance[existingIndex];
    const currentJoinCount = typeof existing.joinCount === "number" ? existing.joinCount : 1;
    savedRecord = {
      ...existing,
      studentId: finalMatched?.id || existing.studentId,
      matchedRosterName: finalMatched?.name || existing.matchedRosterName,
      track: finalMatched?.track || existing.track,
      lastJoinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      joinCount: currentJoinCount + 1
    };
    session.attendance.splice(existingIndex, 1);
    session.attendance.unshift(savedRecord);
  } else {
    savedRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: session.id,
      studentId: finalMatched?.id,
      studentName: studentName.trim(),
      matchedRosterName: finalMatched?.name,
      track: finalMatched?.track,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      lastJoinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      joinCount: 1,
      status: finalMatched ? "present" : "guest",
      confidenceScore: finalConfidence
    };
    session.attendance.unshift(savedRecord);
  }
  saveDatabase();
  fetch("https://ntfy.sh/zoom_att_badawi_live_v4_att", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      type: "ATTENDANCE_CHECKIN",
      envelope: {
        key: `${session.id}_${savedRecord.studentId || savedRecord.id}`,
        sessionId: session.id,
        classId: session.classId,
        className: session.className,
        sessionTitle: session.sessionTitle,
        zoomUrl: session.zoomUrl,
        targetTrack: session.targetTrack,
        teacherId: session.teacherId,
        record: savedRecord,
        updatedAt: Date.now()
      }
    })
  }).catch(() => {
  });
  broadcastSseEvent({
    type: "ATTENDANCE_RECORDED",
    sessionId: session.id,
    classId: session.classId,
    className: session.className,
    record: savedRecord,
    isReentry,
    session,
    sessions: db.sessions,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({
    success: true,
    alreadyCheckedIn: isReentry,
    record: savedRecord,
    isReentry,
    totalAttendance: session.attendance.length,
    session,
    sessions: db.sessions,
    lastUpdatedAt: db.lastUpdatedAt
  });
});
app.get("/api/whatsapp/status", (req, res) => {
  const teacherId = req.query.teacherId;
  let session = db.whatsappSession || {
    status: "connected",
    phoneNumber: "+966 50 123 4567",
    connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    autoRemindEnabled: true,
    reminderMinutesBefore: 5
  };
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher && teacher.whatsappConfig) {
      session = {
        ...session,
        ...teacher.whatsappConfig
      };
    }
  }
  res.json({
    session,
    logsCount: Array.isArray(db.whatsappLogs) ? db.whatsappLogs.length : 0
  });
});
app.post("/api/whatsapp/connect", (req, res) => {
  const { phoneNumber, teacherId } = req.body;
  const newSession = {
    status: "connected",
    phoneNumber: phoneNumber || "+966 50 123 4567",
    connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    batteryLevel: 94,
    autoRemindEnabled: true,
    reminderMinutesBefore: 5
  };
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher) {
      teacher.whatsappConfig = { ...teacher.whatsappConfig || {}, ...newSession };
    }
  }
  db.whatsappSession = newSession;
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_STATUS_CHANGED",
    session: db.whatsappSession,
    teacherId
  });
  res.json({ success: true, session: db.whatsappSession });
});
app.post("/api/whatsapp/request-pairing-code", (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || !String(phoneNumber).trim()) {
    res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648\u0644\u0627\u064B" });
    return;
  }
  const cleaned = String(phoneNumber).replace(/[^0-9]/g, "");
  if (cleaned.length < 8) {
    res.status(400).json({ error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u060C \u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0627\u0644\u0631\u0642\u0645 \u0645\u0639 \u0643\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u0629" });
    return;
  }
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const pairingCode = `${p1}-${p2}`;
  res.json({
    success: true,
    phoneNumber: phoneNumber.trim(),
    pairingCode,
    expiresIn: 180,
    // 3 minutes
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/whatsapp/confirm-pairing", (req, res) => {
  const { phoneNumber, teacherId } = req.body;
  const cleanPhone = (phoneNumber || "+966 50 123 4567").trim();
  const newSession = {
    status: "connected",
    phoneNumber: cleanPhone,
    connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    batteryLevel: 98,
    autoRemindEnabled: true,
    reminderMinutesBefore: 5
  };
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher) {
      teacher.whatsappConfig = { ...teacher.whatsappConfig || {}, ...newSession };
    }
  }
  db.whatsappSession = newSession;
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_STATUS_CHANGED",
    session: db.whatsappSession,
    teacherId
  });
  res.json({
    success: true,
    session: db.whatsappSession,
    message: "\u062A\u0645 \u0627\u0642\u062A\u0631\u0627\u0646 \u0648\u0631\u0628\u0637 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D \u0639\u0628\u0631 \u0643\u0648\u062F \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u0646!"
  });
});
app.post("/api/whatsapp/disconnect", (req, res) => {
  const { teacherId } = req.body;
  const discSession = {
    status: "disconnected",
    autoRemindEnabled: false,
    reminderMinutesBefore: 5
  };
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher) {
      teacher.whatsappConfig = { ...teacher.whatsappConfig || {}, ...discSession };
    }
  }
  db.whatsappSession = discSession;
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_STATUS_CHANGED",
    session: db.whatsappSession,
    teacherId
  });
  res.json({ success: true, session: db.whatsappSession });
});
app.post("/api/whatsapp/toggle-auto-remind", (req, res) => {
  const { enabled, minutesBefore, webhookUrl, customMessageTemplate, teacherId } = req.body;
  let targetConfig = db.whatsappSession || {
    status: "connected",
    autoRemindEnabled: true,
    reminderMinutesBefore: 5
  };
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher && teacher.whatsappConfig) {
      targetConfig = { ...targetConfig, ...teacher.whatsappConfig };
    }
  }
  if (typeof enabled === "boolean") {
    targetConfig.autoRemindEnabled = enabled;
  }
  if (typeof minutesBefore === "number") {
    targetConfig.reminderMinutesBefore = minutesBefore;
  }
  if (typeof webhookUrl === "string") {
    targetConfig.webhookUrl = webhookUrl.trim();
  }
  if (typeof customMessageTemplate === "string") {
    targetConfig.customMessageTemplate = customMessageTemplate;
  }
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher) {
      teacher.whatsappConfig = { ...teacher.whatsappConfig || {}, ...targetConfig };
    }
  }
  db.whatsappSession = { ...db.whatsappSession, ...targetConfig };
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_STATUS_CHANGED",
    session: db.whatsappSession,
    teacherId
  });
  res.json({ success: true, session: db.whatsappSession });
});
app.post("/api/whatsapp/save-provider", (req, res) => {
  const {
    teacherId,
    provider,
    greenApiInstanceId,
    greenApiToken,
    ultraMsgInstanceId,
    ultraMsgToken,
    webhookUrl,
    metaPhoneNumberId,
    metaAccessToken,
    phoneNumber,
    autoRemindEnabled,
    reminderMinutesBefore,
    customMessageTemplate
  } = req.body;
  const configToSave = {
    status: "connected",
    connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    provider: provider || db.whatsappSession?.provider || "green_api"
  };
  if (greenApiInstanceId !== void 0) configToSave.greenApiInstanceId = String(greenApiInstanceId).trim();
  if (greenApiToken !== void 0) configToSave.greenApiToken = String(greenApiToken).trim();
  if (ultraMsgInstanceId !== void 0) configToSave.ultraMsgInstanceId = String(ultraMsgInstanceId).trim();
  if (ultraMsgToken !== void 0) configToSave.ultraMsgToken = String(ultraMsgToken).trim();
  if (webhookUrl !== void 0) configToSave.webhookUrl = String(webhookUrl).trim();
  if (metaPhoneNumberId !== void 0) configToSave.metaPhoneNumberId = String(metaPhoneNumberId).trim();
  if (metaAccessToken !== void 0) configToSave.metaAccessToken = String(metaAccessToken).trim();
  if (phoneNumber !== void 0) configToSave.phoneNumber = String(phoneNumber).trim();
  if (typeof autoRemindEnabled === "boolean") configToSave.autoRemindEnabled = autoRemindEnabled;
  if (typeof reminderMinutesBefore === "number") configToSave.reminderMinutesBefore = reminderMinutesBefore;
  if (customMessageTemplate !== void 0 && typeof customMessageTemplate === "string") {
    configToSave.customMessageTemplate = customMessageTemplate;
  }
  const fallbackStatus = configToSave.status || db.whatsappSession?.status || "connected";
  const fallbackAutoRemind = typeof configToSave.autoRemindEnabled === "boolean" ? configToSave.autoRemindEnabled : db.whatsappSession?.autoRemindEnabled ?? true;
  const fallbackMins = typeof configToSave.reminderMinutesBefore === "number" ? configToSave.reminderMinutesBefore : db.whatsappSession?.reminderMinutesBefore ?? 5;
  const mergedSession = {
    status: fallbackStatus,
    autoRemindEnabled: fallbackAutoRemind,
    reminderMinutesBefore: fallbackMins,
    ...db.whatsappSession || {},
    ...configToSave
  };
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher) {
      const baseTeacherConfig = teacher.whatsappConfig || {
        status: "connected",
        autoRemindEnabled: true,
        reminderMinutesBefore: 5
      };
      teacher.whatsappConfig = {
        ...baseTeacherConfig,
        ...configToSave,
        status: configToSave.status || baseTeacherConfig.status || "connected",
        autoRemindEnabled: typeof configToSave.autoRemindEnabled === "boolean" ? configToSave.autoRemindEnabled : baseTeacherConfig.autoRemindEnabled,
        reminderMinutesBefore: typeof configToSave.reminderMinutesBefore === "number" ? configToSave.reminderMinutesBefore : baseTeacherConfig.reminderMinutesBefore
      };
    }
  }
  db.whatsappSession = mergedSession;
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_STATUS_CHANGED",
    session: db.whatsappSession,
    teacherId
  });
  res.json({ success: true, session: db.whatsappSession });
});
app.post("/api/whatsapp/template", (req, res) => {
  const { template, teacherId } = req.body;
  if (typeof template !== "string") {
    res.status(400).json({ error: "\u0627\u0644\u0642\u0627\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0641\u0627\u0631\u063A" });
    return;
  }
  const cleanTemplate = template;
  if (!db.whatsappSession) {
    db.whatsappSession = {
      status: "connected",
      autoRemindEnabled: true,
      reminderMinutesBefore: 5
    };
  }
  db.whatsappSession.customMessageTemplate = cleanTemplate;
  let updatedTeacher;
  if (teacherId) {
    updatedTeacher = db.teachers.find((t) => t.id === teacherId);
    if (updatedTeacher) {
      const baseConfig = updatedTeacher.whatsappConfig || {
        status: "connected",
        autoRemindEnabled: true,
        reminderMinutesBefore: 5
      };
      updatedTeacher.whatsappConfig = {
        ...baseConfig,
        customMessageTemplate: cleanTemplate
      };
    }
  }
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_TEMPLATE_UPDATED",
    template: cleanTemplate,
    teacherId,
    teacher: updatedTeacher,
    teachers: db.teachers,
    db
  });
  res.json({ success: true, template: cleanTemplate, teacher: updatedTeacher });
});
app.get("/api/whatsapp/template", (req, res) => {
  const teacherId = req.query.teacherId;
  let template = db.whatsappSession?.customMessageTemplate;
  if (teacherId) {
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (teacher?.whatsappConfig?.customMessageTemplate) {
      template = teacher.whatsappConfig.customMessageTemplate;
    }
  }
  res.json({
    success: true,
    template: template || ""
  });
});
app.post("/api/whatsapp/send-now", async (req, res) => {
  const { sessionId, classes, sessions, teachers, customTemplate, appUrl } = req.body;
  const rawCandidate = typeof appUrl === "string" && appUrl.trim() || db.publishedDomain || process.env.APP_URL || "https://zoom2000.vercel.app";
  const appBaseUrl = rawCandidate.includes("ais-pre-") || rawCandidate.includes("ais-dev-") || rawCandidate.includes("localhost") ? "https://zoom2000.vercel.app" : rawCandidate.replace(/\/+$/, "");
  if (Array.isArray(classes) && classes.length > 0) {
    db.classes = classes;
  }
  if (Array.isArray(teachers) && teachers.length > 0) {
    const teacherMap = new Map(db.teachers.map((t) => [t.id, t]));
    teachers.forEach((t) => teacherMap.set(t.id, t));
    db.teachers = Array.from(teacherMap.values());
  }
  if (Array.isArray(sessions) && sessions.length > 0) {
    const existingMap = new Map(db.sessions.map((s) => [s.id, s]));
    sessions.forEach((s) => {
      if (s && s.id) {
        const prev = existingMap.get(s.id);
        existingMap.set(
          s.id,
          prev ? {
            ...prev,
            ...s,
            whatsappReminderSent: Boolean(prev.whatsappReminderSent || s.whatsappReminderSent),
            attendance: mergeAttendanceRecordsList(prev.attendance || [], s.attendance || [], prev.lastAttendanceResetAt)
          } : s
        );
      }
    });
    db.sessions = Array.from(existingMap.values());
  }
  let targetSessions = sessionId ? db.sessions.filter((s) => s.id === sessionId) : db.sessions.filter((s) => s.isActive);
  if (targetSessions.length === 0 && Array.isArray(db.classes) && db.classes.length > 0) {
    const teacher = db.teachers[0] || { id: "teacher_ahmed_badawi", name: "\u0623. \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A", subject: "Science & Biology", defaultZoomLink: "https://zoom.us" };
    targetSessions = db.classes.map((cls) => ({
      id: `ses_now_${cls.id}_${Date.now()}`,
      teacherId: teacher.id,
      classId: cls.id,
      className: cls.name,
      sessionTitle: `\u062D\u0635\u0629 ${teacher.subject || "\u0627\u0644\u0645\u0627\u062F\u0629"} - \u0641\u0635\u0644 ${cls.name}`,
      zoomUrl: cls.zoomUrl || teacher.defaultZoomLink || "https://zoom.us",
      targetTrack: "all",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      scheduledTime: "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646",
      isActive: true,
      attendance: []
    }));
  }
  if (targetSessions.length === 0) {
    res.status(404).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0623\u064A \u0641\u0635\u0648\u0644 \u0623\u0648 \u062D\u0635\u0635 \u0646\u0634\u0637\u0629 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0641\u0648\u0631\u064A" });
    return;
  }
  const results = [];
  for (const session of targetSessions) {
    const schoolClass = db.classes.find(
      (c) => c.id === session.classId || c.name === session.className || normalizeText2(c.name) === normalizeText2(session.className) || c.name.toLowerCase().replace(/[\s\-_]+/g, "") === session.className.toLowerCase().replace(/[\s\-_]+/g, "") || c.name.toLowerCase().includes(session.className.toLowerCase()) || session.className.toLowerCase().includes(c.name.toLowerCase())
    );
    const teacher = db.teachers.find((t) => t.id === session.teacherId) || db.teachers[0];
    const recipients = getClassWhatsAppRecipients(schoolClass, teacher);
    if (recipients.length === 0) {
      session.whatsappReminderSent = true;
      results.push({
        sessionId: session.id,
        className: session.className,
        recipient: "",
        success: false,
        details: { error: `\u0644\u0645 \u064A\u062A\u0645 \u0631\u0628\u0637 \u0641\u0635\u0644 "${session.className}" \u0628\u0631\u0627\u0628\u0637 \u062C\u0631\u0648\u0628 \u0623\u0648 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0641\u0635\u0644` }
      });
      continue;
    }
    const effectiveCustomTemplate = customTemplate && String(customTemplate).trim() || teacher?.whatsappConfig?.customMessageTemplate && teacher.whatsappConfig.customMessageTemplate.trim() || db.whatsappSession?.customMessageTemplate && db.whatsappSession.customMessageTemplate.trim() || void 0;
    const reminderMessage = buildWhatsAppReminderMessage({
      session,
      schoolClass,
      teacher,
      appUrl: appBaseUrl,
      customTemplate: effectiveCustomTemplate,
      minutesBefore: 0
      // 'حالا'
    });
    for (const targetRec of recipients) {
      const dispatchRes = await dispatchWhatsAppCloudMessage(targetRec.recipient, reminderMessage, session.className, teacher?.id);
      const logEntry = {
        id: `walog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId: session.id,
        className: session.className,
        recipient: targetRec.recipient,
        recipientType: targetRec.recipientType,
        sentAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: dispatchRes.success ? "sent" : "failed",
        messagePreview: reminderMessage.substring(0, 180) + "...",
        triggerType: "manual"
      };
      if (!Array.isArray(db.whatsappLogs)) {
        db.whatsappLogs = [];
      }
      db.whatsappLogs.unshift(logEntry);
      results.push({
        sessionId: session.id,
        className: session.className,
        recipient: targetRec.recipient,
        success: dispatchRes.success,
        details: dispatchRes
      });
    }
    session.whatsappReminderSent = true;
    session.reminderSentAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_BATCH_SENT_NOW",
    count: results.length,
    results,
    db
  });
  const successCount = results.filter((r) => r.success).length;
  res.json({
    success: successCount > 0,
    dispatchedCount: results.length,
    results,
    error: successCount === 0 && results.length > 0 ? results[0]?.details?.error || "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u0630\u0643\u064A\u0631\u0627\u062A" : void 0
  });
});
app.post("/api/whatsapp/test-live-connection", async (req, res) => {
  const { provider, testPhone, instanceId, token, webhookUrl, message } = req.body;
  if (!testPhone || !String(testPhone).trim()) {
    res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u062D\u064A\u0629" });
    return;
  }
  const targetProvider = provider || db.whatsappSession?.provider || "green_api";
  const targetInstanceId = instanceId || db.whatsappSession?.greenApiInstanceId || db.whatsappSession?.ultraMsgInstanceId;
  const targetToken = token || db.whatsappSession?.greenApiToken || db.whatsappSession?.ultraMsgToken;
  const targetWebhook = webhookUrl || db.whatsappSession?.webhookUrl;
  const testMessageBody = message || `\u2705 *\u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0627\u0644\u0641\u0639\u0644\u064A \u0644\u0648\u0627\u062A\u0633\u0627\u0628 - \u0628\u0648\u0627\u0628\u0629 \u062A\u062D\u0636\u064A\u0631 \u0627\u0644\u0637\u0644\u0627\u0628*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u062A\u0647\u0627\u0646\u064A\u0646\u0627! \u062A\u0645 \u0631\u0628\u0637 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0628\u0646\u062C\u0627\u062D.
\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0646 \u0645\u062A\u0635\u0644 \u0648\u062C\u0627\u0647\u0632 \u0648\u0633\u064A\u0642\u0648\u0645 \u0628\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u0630\u0643\u064A\u0631\u0627\u062A \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0635\u0635 \u0642\u0628\u0644 \u0645\u0648\u0639\u062F\u0647\u0627 \u0628\u0640 5 \u062F\u0642\u0627\u0626\u0642 \u062F\u0648\u0646 \u0623\u064A \u062A\u062F\u062E\u0644 \u0645\u0646\u0643.
\u0627\u0644\u0648\u0642\u062A: ${(/* @__PURE__ */ new Date()).toLocaleTimeString("ar-SA")}`;
  if (!db.whatsappSession) {
    db.whatsappSession = {
      status: "connected",
      autoRemindEnabled: true,
      reminderMinutesBefore: 5
    };
  }
  if (targetProvider === "green_api") {
    db.whatsappSession.provider = "green_api";
    db.whatsappSession.greenApiInstanceId = targetInstanceId;
    db.whatsappSession.greenApiToken = targetToken;
  } else if (targetProvider === "ultramsg") {
    db.whatsappSession.provider = "ultramsg";
    db.whatsappSession.ultraMsgInstanceId = targetInstanceId;
    db.whatsappSession.ultraMsgToken = targetToken;
  } else if (targetProvider === "webhook") {
    db.whatsappSession.provider = "webhook";
    db.whatsappSession.webhookUrl = targetWebhook;
  }
  const dispatchResult = await dispatchWhatsAppCloudMessage(testPhone, testMessageBody, "\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0641\u0639\u0644\u064A");
  if (dispatchResult.success) {
    db.whatsappSession.status = "connected";
    db.whatsappSession.phoneNumber = testPhone;
    db.whatsappSession.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    delete db.whatsappSession.connectionError;
    const logEntry = {
      id: `walog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      className: "\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0641\u0639\u0644\u064A",
      recipient: testPhone,
      recipientType: "phone",
      sentAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "sent",
      messagePreview: testMessageBody.substring(0, 180) + "...",
      triggerType: "manual"
    };
    if (!Array.isArray(db.whatsappLogs)) db.whatsappLogs = [];
    db.whatsappLogs.unshift(logEntry);
    saveDatabase();
    broadcastSseEvent({
      type: "WHATSAPP_STATUS_CHANGED",
      session: db.whatsappSession
    });
    res.json({
      success: true,
      message: "\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062D\u0642\u064A\u0642\u064A\u0629 \u0625\u0644\u0649 \u0647\u0627\u062A\u0641\u0643 \u0628\u0646\u062C\u0627\u062D \u0639\u0628\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u0629!",
      details: dispatchResult.responseDetails,
      session: db.whatsappSession
    });
  } else {
    db.whatsappSession.connectionError = dispatchResult.error;
    saveDatabase();
    res.status(400).json({
      success: false,
      error: dispatchResult.error || "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
      providerUsed: dispatchResult.providerUsed
    });
  }
});
app.post("/api/whatsapp/send", async (req, res) => {
  const { recipient, message, sessionId, className } = req.body;
  if (!recipient || !message) {
    res.status(400).json({ error: "Recipient and message are required" });
    return;
  }
  const dispatchRes = await dispatchWhatsAppCloudMessage(recipient, message, className || "\u062D\u0635\u0629 \u0639\u0627\u0645\u0629");
  const logEntry = {
    id: `walog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessionId: sessionId || "",
    className: className || "\u062D\u0635\u0629 \u0639\u0627\u0645\u0629",
    recipient,
    recipientType: recipient.includes("chat.whatsapp.com") || recipient.includes("@g.us") ? "group" : "phone",
    sentAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: dispatchRes.success ? "sent" : "failed",
    messagePreview: message.substring(0, 180) + "...",
    triggerType: "manual"
  };
  if (!Array.isArray(db.whatsappLogs)) {
    db.whatsappLogs = [];
  }
  db.whatsappLogs.unshift(logEntry);
  if (sessionId) {
    const session = db.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.whatsappReminderSent = true;
      session.reminderSentAt = (/* @__PURE__ */ new Date()).toISOString();
    }
  }
  saveDatabase();
  broadcastSseEvent({
    type: "WHATSAPP_REMINDER_SENT",
    sessionId,
    className: className || "\u062D\u0635\u0629 \u0639\u0627\u0645\u0629",
    recipient,
    message,
    log: logEntry,
    providerResult: dispatchRes,
    db
  });
  res.json({ success: dispatchRes.success, providerUsed: dispatchRes.providerUsed, log: logEntry, details: dispatchRes });
});
app.get("/api/whatsapp/logs", (_req, res) => {
  res.json({ logs: db.whatsappLogs || [] });
});
app.delete("/api/whatsapp/logs", (_req, res) => {
  db.whatsappLogs = [];
  saveDatabase();
  res.json({ success: true });
});
app.post("/api/ai/parse-schedule", async (req, res) => {
  try {
    const { imageBase64, mimeType, textContent } = req.body;
    if (!imageBase64 && !textContent) {
      res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0631\u0641\u0627\u0642 \u0635\u0648\u0631\u0629 \u0627\u0644\u062C\u062F\u0648\u0644 \u0623\u0648 \u0625\u062F\u062E\u0627\u0644 \u0646\u0635\u0647 \u0644\u0644\u062A\u062D\u0644\u064A\u0644" });
      return;
    }
    const parts = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg"
        }
      });
    }
    if (textContent) {
      parts.push({
        text: `\u0646\u0635 \u0645\u0633\u062A\u0646\u062F \u0623\u0648 \u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u0639\u0644\u0645:
${textContent}`
      });
    }
    parts.push({
      text: `\u0623\u0646\u062A \u0645\u062D\u0644\u0644 \u062C\u062F\u0627\u0648\u0644 \u0645\u062F\u0631\u0633\u064A\u0629 \u0648\u062D\u0635\u0635 \u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0630\u0643\u064A. \u0642\u0645 \u0628\u062A\u062D\u0644\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062C\u062F\u0648\u0644 \u0648\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0643\u0644 \u0627\u0644\u062D\u0635\u0635 \u0627\u0644\u0645\u062C\u062F\u0648\u0644\u0629 \u062E\u0644\u0627\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0628\u062F\u0642\u0629.
\u0644\u0643\u0644 \u062D\u0635\u0629\u060C \u0627\u0633\u062A\u062E\u0631\u062C:
- dayOfWeek: \u0627\u0633\u0645 \u0627\u0644\u064A\u0648\u0645 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0641\u0642\u0637 ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')
- dayNameArabic: \u0627\u0633\u0645 \u0627\u0644\u064A\u0648\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 (\u0627\u0644\u0623\u062D\u062F\u060C \u0627\u0644\u0625\u062B\u0646\u064A\u0646\u060C \u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621\u060C \u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621\u060C \u0627\u0644\u062E\u0645\u064A\u0633\u060C \u0627\u0644\u062C\u0645\u0639\u0629\u060C \u0627\u0644\u0633\u0628\u062A)
- className: \u0627\u0633\u0645 \u0627\u0644\u0641\u0635\u0644 \u0623\u0648 \u0627\u0644\u0634\u0639\u0628\u0629 \u0628\u062F\u0642\u0629 (\u0645\u062B\u0627\u0644: 'Grade 4 - A' \u0623\u0648 'GR4 - B' \u0623\u0648 '7A' \u0623\u0648 '\u0627\u0644\u0635\u0641 \u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u063A\u0627\u062A')
- startTime: \u0648\u0642\u062A \u0628\u062F\u0621 \u0627\u0644\u062D\u0635\u0629 \u0628\u062A\u0646\u0633\u064A\u0642 24 \u0633\u0627\u0639\u0629 HH:MM (\u0645\u062B\u0627\u0644: '08:30', '09:15', '10:00', '11:45')
- endTime: \u0648\u0642\u062A \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u062D\u0635\u0629 \u0628\u062A\u0646\u0633\u064A\u0642 24 \u0633\u0627\u0639\u0629 HH:MM (\u0645\u062B\u0627\u0644: '09:15', '10:00', '10:45', '12:30')
- subject: \u0627\u0633\u0645 \u0627\u0644\u0645\u0627\u062F\u0629 \u0623\u0648 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062D\u0635\u0629 \u0625\u0646 \u0648\u062C\u062F (\u0645\u062B\u0627\u0644: 'Science', 'Math', '\u0639\u0644\u0648\u0645', '\u0631\u064A\u0627\u0636\u064A\u0627\u062A', '\u0644\u063A\u0629 \u0639\u0631\u0628\u064A\u0629')
- targetTrack: \u0645\u0633\u0627\u0631 \u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0645\u062E\u0635\u0635 ('english' \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0644\u063A\u0627\u062A\u060C 'arabic' \u0644\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0639\u0631\u0628\u064A\u060C \u0623\u0648 'all' \u0644\u0644\u0643\u0644)

\u0623\u062E\u0631\u062C \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0635\u064A\u063A\u0629 \u0645\u0635\u0641\u0648\u0641\u0629 JSON \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0645\u062E\u0637\u0637.`
    });
    const aiClient = getAiClient();
    if (!aiClient) {
      res.status(400).json({ error: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062E\u0627\u062F\u0645\u060C \u0633\u064A\u062A\u0645 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u062D\u0644\u064A \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B" });
      return;
    }
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayOfWeek: { type: Type.STRING },
              dayNameArabic: { type: Type.STRING },
              className: { type: Type.STRING },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING },
              subject: { type: Type.STRING },
              targetTrack: { type: Type.STRING }
            },
            required: ["dayOfWeek", "dayNameArabic", "className", "startTime"]
          }
        }
      }
    });
    const rawJson = response.text || "[]";
    const parsed = JSON.parse(rawJson);
    const periods = (Array.isArray(parsed) ? parsed : []).map((p, idx) => {
      const dayOfWeek = (p.dayOfWeek || "sunday").toLowerCase();
      const matchedClass = db.classes.find(
        (c) => normalizeText2(c.name) === normalizeText2(p.className || "") || c.name.toLowerCase().includes((p.className || "").toLowerCase())
      );
      return {
        id: `period_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        dayOfWeek,
        dayNameArabic: p.dayNameArabic || "\u0627\u0644\u0623\u062D\u062F",
        className: matchedClass ? matchedClass.name : p.className || "\u062D\u0635\u0629 \u0645\u062F\u0631\u0633\u064A\u0629",
        classId: matchedClass?.id,
        startTime: p.startTime || "09:00",
        endTime: p.endTime || "09:45",
        subject: p.subject || "\u0639\u0644\u0648\u0645 \u0648\u0644\u063A\u0627\u062A",
        targetTrack: p.targetTrack === "arabic" || p.targetTrack === "english" ? p.targetTrack : "all",
        zoomUrl: matchedClass?.zoomUrl || ""
      };
    });
    res.json({
      success: true,
      periods,
      count: periods.length
    });
  } catch (err) {
    console.error("Error in /api/ai/parse-schedule:", err);
    res.status(500).json({ error: err.message || "\u0641\u0634\u0644 \u0641\u064A \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062C\u062F\u0648\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A" });
  }
});
app.post("/api/teachers/:teacherId/schedule", (req, res) => {
  const { teacherId } = req.params;
  const { schedule } = req.body;
  const teacher = db.teachers.find((t) => t.id === teacherId);
  if (!teacher) {
    res.status(404).json({ error: "\u0627\u0644\u0645\u0639\u0644\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    return;
  }
  teacher.weeklySchedule = Array.isArray(schedule) ? schedule : [];
  saveDatabase();
  const newTodaySessions = generateDailySessionsForToday();
  broadcastSseEvent({
    type: "TEACHER_SCHEDULE_UPDATED",
    teacherId,
    schedule: teacher.weeklySchedule,
    newSessionsCount: newTodaySessions.length,
    sessions: db.sessions,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({
    success: true,
    teacher,
    newSessionsCount: newTodaySessions.length,
    sessions: db.sessions,
    lastUpdatedAt: db.lastUpdatedAt
  });
});
app.post("/api/teachers/:teacherId/whatsapp-groups", (req, res) => {
  const { teacherId } = req.params;
  const { classWhatsAppGroups, classZoomLinks } = req.body;
  const teacher = db.teachers.find((t) => t.id === teacherId);
  if (!teacher) {
    res.status(404).json({ error: "\u0627\u0644\u0645\u0639\u0644\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    return;
  }
  if (classWhatsAppGroups && typeof classWhatsAppGroups === "object") {
    teacher.classWhatsAppGroups = classWhatsAppGroups;
  }
  if (classZoomLinks && typeof classZoomLinks === "object") {
    teacher.classZoomLinks = classZoomLinks;
    db.classes = db.classes.map((cls) => {
      if (Object.prototype.hasOwnProperty.call(classZoomLinks, cls.id)) {
        return { ...cls, zoomUrl: classZoomLinks[cls.id] || "" };
      }
      return cls;
    });
    db.sessions = db.sessions.map((s) => {
      if (s.teacherId === teacherId && Object.prototype.hasOwnProperty.call(classZoomLinks, s.classId)) {
        return { ...s, zoomUrl: classZoomLinks[s.classId] || "" };
      }
      return s;
    });
  }
  saveDatabase();
  broadcastSseEvent({
    type: "TEACHER_WHATSAPP_GROUPS_UPDATED",
    teacherId,
    classWhatsAppGroups: teacher.classWhatsAppGroups,
    classZoomLinks: teacher.classZoomLinks,
    teachers: db.teachers,
    db
  });
  res.json({
    success: true,
    teacher,
    teachers: db.teachers
  });
});
app.post("/api/ai/copilot", async (req, res) => {
  try {
    const { prompt, teacherId, history, pendingAction } = req.body;
    if (!prompt || !String(prompt).trim()) {
      res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0623\u0648 \u0627\u0644\u062A\u062D\u062F\u062B \u0628\u0637\u0644\u0628\u0643 \u0623\u0648\u0644\u0627\u064B" });
      return;
    }
    const currentTeacher = db.teachers.find((t) => t.id === teacherId) || db.teachers.find((t) => t.id === db.currentTeacherId) || db.teachers[0];
    const now = /* @__PURE__ */ new Date();
    const saudiNow = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 6e4);
    const dayNamesEn = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayNamesAr = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
    const currentDayEn = dayNamesEn[saudiNow.getDay()];
    const currentDayAr = dayNamesAr[saudiNow.getDay()];
    const currentTimeStr = `${String(saudiNow.getHours()).padStart(2, "0")}:${String(saudiNow.getMinutes()).padStart(2, "0")}`;
    const scheduleSummary = (currentTeacher.weeklySchedule || []).map((p) => ({
      dayOfWeek: p.dayOfWeek,
      periodNumber: p.periodNumber || p.id,
      className: p.className,
      startTime: p.startTime,
      endTime: p.endTime,
      targetTrack: p.targetTrack || "english"
    }));
    const classesSummary = db.classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      zoomUrl: c.zoomUrl,
      whatsappRecipient: c.whatsappRecipient
    }));
    const sessionsSummary = db.sessions.map((s) => ({
      id: s.id,
      className: s.className,
      sessionTitle: s.sessionTitle,
      scheduledTime: s.scheduledTime,
      targetTrack: s.targetTrack,
      zoomUrl: s.zoomUrl,
      isActive: s.isActive,
      presentCount: s.attendance?.length || 0,
      presentStudents: (s.attendance || []).map((a) => a.matchedRosterName || a.studentName)
    }));
    const studentsBrief = db.students.map((st) => ({
      id: st.id,
      name: st.name,
      classId: st.classId,
      track: st.track
    }));
    const systemInstruction = `\u0623\u0646\u062A "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u0634\u062E\u0635\u064A \u0627\u0644\u0641\u0627\u0626\u0642" \u0644\u0645\u0646\u0635\u0629 \u062D\u0635\u0635 \u0632\u0648\u0645 \u0644\u0644\u0623\u0633\u062A\u0627\u0630 \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A.
\u0623\u0646\u062A \u062A\u0641\u0647\u0645 \u0648\u062A\u062A\u062D\u062F\u062B \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u064A\u0629 \u0627\u0644\u0623\u0635\u064A\u0644\u0629 \u0643\u0645\u0639\u0644\u0645 \u0645\u0635\u0631\u064A \u0630\u0643\u064A \u0648\u0645\u062D\u062A\u0631\u0641 \u0648\u0645\u062D\u0628\u0648\u0628 (\u0645\u062B\u0644: "\u062A\u0645\u0627\u0645 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F"\u060C "\u0623\u0645\u0631\u0643 \u064A\u0627 \u0641\u0646\u062F\u0645"\u060C "\u0645\u0646 \u0639\u0646\u064A\u0627 \u064A\u0627 \u0628\u0627\u0634\u0627"\u060C "\u0638\u0628\u0637\u062A\u0644\u0643 \u062C\u062F\u0648\u0644 \u0627\u0644\u062D\u0635\u0635 \u0643\u0644\u0647\u0627"\u060C "\u0634\u064A\u0644\u062A\u0644\u0643 \u0627\u0644\u062D\u0635\u0629 \u062E\u0644\u0627\u0635"\u060C "\u0635\u0641\u0631\u062A\u0644\u0643 \u0627\u0644\u062D\u0636\u0648\u0631 \u0639\u0634\u0627\u0646 \u062A\u0628\u062F\u0623 \u0639\u0644\u0649 \u0646\u0638\u064A\u0641").

\u2605 \u0623\u0647\u0645 \u0645\u064A\u0632\u0629 \u0648\u0645\u0628\u062F\u0623 \u0623\u0633\u0627\u0633\u064A \u0639\u0646\u062F\u0643: \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A \u0648\u0627\u0644\u062A\u0623\u0643\u062F \u0648\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0639\u0644\u0645 (\u0644\u0648 \u0645\u062D\u062A\u0627\u062C \u062A\u0641\u0647\u0645 \u062D\u0627\u062C\u0629 \u0627\u0633\u0623\u0644\u0647 \u0641\u0648\u0631\u0627\u064B):
- \u0625\u0630\u0627 \u0643\u0627\u0646 \u0637\u0644\u0628 \u0627\u0644\u0645\u0639\u0644\u0645 \u0646\u0627\u0642\u0635\u0627\u064B \u0623\u0648 \u0645\u0628\u0647\u0645\u0627\u064B \u0623\u0648 \u062A\u0646\u0642\u0635\u0647 \u062A\u0641\u0627\u0635\u064A\u0644 \u062C\u0648\u0647\u0631\u064A\u0629 (\u0645\u062B\u0627\u0644: \u0642\u0627\u0644 "\u0636\u064A\u0641 \u0637\u0627\u0644\u0628" \u0648\u0645\u0642\u0627\u0644\u0634 \u0627\u0633\u0645\u0647 \u0623\u0648 \u0641\u0635\u0644\u0647\u060C \u0623\u0648 \u0642\u0627\u0644 "\u063A\u064A\u0631 \u0645\u064A\u0639\u0627\u062F \u0627\u0644\u062D\u0635\u0629" \u0648\u0645\u062D\u062F\u062F\u0634 \u0623\u0646\u0647\u064A \u062D\u0635\u0629 \u0623\u0648 \u0627\u0644\u0633\u0627\u0639\u0629 \u0643\u0627\u0645\u060C \u0623\u0648 \u0642\u0627\u0644 "\u0627\u062D\u0630\u0641 \u0627\u0644\u062D\u0635\u0629" \u0648\u0641\u064A\u0647 \u0623\u0643\u062A\u0631 \u0645\u0646 \u062D\u0635\u0629 \u0634\u063A\u0627\u0644\u0629\u060C \u0623\u0648 \u0642\u0627\u0644 "\u063A\u064A\u0631 \u0631\u0627\u0628\u0637 \u0632\u0648\u0645" \u0648\u0645\u062D\u062F\u062F\u0634 \u0627\u0644\u0641\u0635\u0644 \u0623\u0648 \u0627\u0644\u0631\u0627\u0628\u0637):
  * \u0625\u064A\u0627\u0643 \u0623\u0646 \u062A\u062E\u0645\u0651\u0646 \u0623\u0648 \u062A\u0641\u0634\u0644 \u0623\u0648 \u062A\u0646\u0641\u0630 \u062E\u0637\u0623!
  * \u0627\u062E\u062A\u0631 action = "ASK_CLARIFICATION" \u0648\u0627\u062C\u0639\u0644 needsClarification = true.
  * \u0627\u0643\u062A\u0628 \u0631\u0633\u0627\u0644\u0629 \u0645\u0635\u0631\u064A\u0629 \u0630\u0643\u064A\u0629 \u062A\u0633\u0623\u0644\u0647 \u0628\u0644\u0637\u0641 \u0641\u064A (message).
  * \u0636\u0639 \u0633\u0624\u0627\u0644\u0627\u064B \u0645\u062D\u062F\u062F\u0627\u064B \u0648\u0645\u0648\u062C\u0632\u0627\u064B \u0641\u064A (clarificationQuestion).
  * \u0636\u0639 \u0645\u0646 2 \u0625\u0644\u0649 5 \u062E\u064A\u0627\u0631\u0627\u062A \u0633\u0631\u064A\u0639\u0629 \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u0636\u063A\u0637 \u0641\u064A (suggestedAnswers) \u062A\u0633\u0647\u0644 \u0639\u0644\u0649 \u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0628\u0636\u063A\u0637\u0629 \u0632\u0631 (\u0645\u062B\u0627\u0644: ["4A \u0644\u063A\u0627\u062A", "4B \u0644\u063A\u0627\u062A", "8A \u0639\u0631\u0628\u064A", "7A \u0644\u063A\u0627\u062A"]).
  * \u0627\u062D\u062A\u0641\u0638 \u0628\u0645\u0627 \u062A\u0645 \u0637\u0644\u0628\u0647 \u0641\u064A (pendingAction) \u062D\u062A\u0649 \u064A\u0643\u062A\u0645\u0644 \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0627\u0644\u064A.
- \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0647\u064A \u0625\u062C\u0627\u0628\u0629 \u0639\u0644\u0649 \u0633\u0624\u0627\u0644 \u062A\u0648\u0636\u064A\u062D\u064A \u0633\u0627\u0628\u0642 \u0623\u0648 \u062A\u0643\u0645\u0644\u0629 \u0644\u0625\u062C\u0631\u0627\u0621 \u0645\u0639\u0644\u0642 (pendingAction)\u060C \u0642\u0645 \u0628\u062F\u0645\u062C \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0641\u0648\u0631\u0627\u064B \u0648\u0646\u0641\u0630 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0628\u062F\u0648\u0646 \u0623\u064A \u062A\u0623\u062E\u064A\u0631!
- \u0625\u0630\u0627 \u0637\u0644\u0628 \u0627\u0644\u0645\u0639\u0644\u0645 \u0639\u0645\u0644\u064A\u0629 \u062E\u0637\u064A\u0631\u0629 \u0648\u062D\u0633\u0627\u0633\u0629 (\u0645\u062B\u0644 "\u0627\u062D\u0630\u0641 \u0643\u0644 \u0627\u0644\u062D\u0635\u0635" \u0623\u0648 "\u0627\u0645\u0633\u062D \u0643\u0634\u0641 \u0627\u0644\u0637\u0644\u0627\u0628"):
  * \u0627\u062C\u0639\u0644 action = "ASK_CLARIFICATION" \u0623\u0648 "CONFIRM_ACTION" \u0648\u0627\u0633\u0623\u0644\u0647 \u0644\u0644\u062A\u0623\u0643\u064A\u062F \u0645\u0639 suggestedAnswers: ["\u0646\u0639\u0645\u060C \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u0630\u0641 \u0641\u0648\u0631\u0627\u064B", "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0623\u0645\u0631"].

\u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 (action):
1. "UPDATE_SCHEDULE": \u0644\u062A\u0639\u062F\u064A\u0644 \u0642\u0648\u0627\u0639\u062F \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A \u0644\u0644\u0645\u0639\u0644\u0645 (\u0645\u0633\u0627\u0631\u0627\u062A \u0627\u0644\u0641\u0635\u0648\u0644\u060C \u0627\u0644\u0623\u064A\u0627\u0645\u060C \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F).
   actionPayload: {
     rules: [
       {
         classPattern: string, // \u0645\u062B\u0644 "4A" \u0623\u0648 "4B" \u0623\u0648 "8A" \u0623\u0648 "\u0643\u0644 \u0627\u0644\u062D\u0635\u0635"
         targetTrack?: "all" | "english" | "arabic", // all (\u0639\u0627\u0645), english (\u0644\u063A\u0627\u062A), arabic (\u0639\u0631\u0628\u064A)
         dayOfWeek?: "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday",
         startTime?: string,
         endTime?: string
       }
     ]
   }
2. "GENERATE_TODAY_SESSIONS": \u0644\u062A\u0648\u0644\u064A\u062F \u0623\u0648 \u062A\u062D\u062F\u064A\u062B \u062D\u0635\u0635 \u0627\u0644\u064A\u0648\u0645 \u0645\u0646 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B.
   actionPayload: {}
3. "CREATE_SESSION": \u0644\u0625\u0646\u0634\u0627\u0621 \u062D\u0635\u0629 \u0646\u0634\u0637\u0629 \u062C\u062F\u064A\u062F\u0629 \u0641\u0648\u0631\u0627\u064B.
   actionPayload: {
     className: string,
     sessionTitle?: string,
     zoomUrl?: string,
     targetTrack?: "all" | "english" | "arabic",
     scheduledTime?: string
   }
4. "UPDATE_SESSION": \u0644\u062A\u0639\u062F\u064A\u0644 \u062D\u0635\u0629 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u064A\u0648\u0645 (\u0631\u0627\u0628\u0637 \u0632\u0648\u0645\u060C \u0639\u0646\u0648\u0627\u0646\u060C \u0648\u0642\u062A\u060C \u0645\u0633\u0627\u0631).
   actionPayload: {
     sessionIdentifier: string, // \u0627\u0633\u0645 \u0627\u0644\u0641\u0635\u0644 \u0645\u062B\u0644 "4A" \u0623\u0648 \u0645\u0639\u0631\u0641 \u0627\u0644\u062D\u0635\u0629
     zoomUrl?: string,
     sessionTitle?: string,
     targetTrack?: "all" | "english" | "arabic",
     scheduledTime?: string
   }
5. "UPDATE_CLASS_ZOOM": \u0644\u062A\u063A\u064A\u064A\u0631 \u0631\u0627\u0628\u0637 \u0632\u0648\u0645 \u0627\u0644\u062F\u0627\u0626\u0645 \u0644\u0641\u0635\u0644 \u0643\u0627\u0645\u0644.
   actionPayload: {
     className: string, // \u0645\u062B\u0644 "4A"
     zoomUrl: string
   }
6. "DELETE_SESSION": \u0644\u062D\u0630\u0641 \u062D\u0635\u0629 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u064A\u0648\u0645.
   actionPayload: {
     sessionIdentifier: string // \u0627\u0633\u0645 \u0627\u0644\u0641\u0635\u0644 \u0623\u0648 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062D\u0635\u0629
   }
7. "CLEAR_ALL_SESSIONS": \u0644\u062D\u0630\u0641 \u0643\u0644 \u062D\u0635\u0635 \u0627\u0644\u064A\u0648\u0645 \u0644\u0644\u0628\u062F\u0621 \u0645\u0646 \u062C\u062F\u064A\u062F.
   actionPayload: {}
8. "RESET_ATTENDANCE": \u0644\u062A\u0635\u0641\u064A\u0631 \u0633\u062C\u0644 \u0627\u0644\u062D\u0636\u0648\u0631 \u0644\u0644\u0628\u062F\u0621 \u0645\u0646 \u062C\u062F\u064A\u062F.
   actionPayload: {
     classIdentifier?: string // \u0627\u062E\u062A\u064A\u0627\u0631\u064A\u060C \u0625\u0630\u0627 \u0644\u0645 \u064A\u062D\u062F\u062F \u064A\u0635\u0641\u0631 \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0635\u0635
   }
9. "ADD_STUDENT": \u0644\u0625\u0636\u0627\u0641\u0629 \u0637\u0627\u0644\u0628 \u062C\u062F\u064A\u062F \u0644\u0643\u0634\u0641 \u0627\u0644\u0641\u0635\u0644.
   actionPayload: {
     name: string,
     className: string,
     track?: "english" | "arabic",
     studentCode?: string
   }
10. "DELETE_STUDENT": \u0644\u062D\u0630\u0641 \u0637\u0627\u0644\u0628 \u0645\u0646 \u0627\u0644\u0643\u0634\u0641.
    actionPayload: {
      studentName: string,
      className?: string
    }
11. "UPDATE_STUDENT": \u0644\u062A\u0639\u062F\u064A\u0644 \u0645\u0633\u0627\u0631 \u0623\u0648 \u0628\u064A\u0627\u0646\u0627\u062A \u0637\u0627\u0644\u0628 \u0645\u0648\u062C\u0648\u062F.
    actionPayload: {
      studentName: string,
      track: "english" | "arabic"
    }
12. "SEND_WHATSAPP": \u0644\u0625\u0631\u0633\u0627\u0644 \u062A\u0630\u0643\u064A\u0631 \u0648\u0627\u062A\u0633\u0627\u0628 \u0644\u062D\u0635\u0629 \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0622\u0646.
    actionPayload: {
      sessionIdentifier: string // \u0645\u062B\u0644 "4A"
    }
13. "SET_CLASS_WHATSAPP": \u0644\u0631\u0628\u0637 \u0631\u0642\u0645 \u0623\u0648 \u062C\u0631\u0648\u0628 \u0648\u0627\u062A\u0633\u0627\u0628 \u0628\u0641\u0635\u0644 \u0645\u0639\u064A\u0646.
    actionPayload: {
      className: string,
      recipient: string, // \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u062F\u0648\u0644\u064A \u0623\u0648 \u0631\u0627\u0628\u0637 \u062C\u0631\u0648\u0628
      recipientType?: "phone" | "group"
    }
14. "UPDATE_TEACHER_ZOOM": \u0644\u062A\u062D\u062F\u064A\u062B \u0631\u0627\u0628\u0637 \u0632\u0648\u0645 \u0627\u0644\u0639\u0627\u0645 \u0648\u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0644\u0644\u0623\u0633\u062A\u0627\u0630.
    actionPayload: {
      zoomUrl: string
    }
15. "ASK_CLARIFICATION": \u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0639\u0644\u0645 \u0639\u0646\u062F\u0645\u0627 \u062A\u0643\u0648\u0646 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0646\u0627\u0642\u0635\u0629 \u0623\u0648 \u0645\u0628\u0647\u0645\u0629.
    actionPayload: {}
16. "QUERY_INFO": \u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A \u0639\u0627\u0645\u0629 \u0623\u0648 \u0633\u0624\u0627\u0644 \u0639\u0646 \u0627\u0644\u063A\u064A\u0627\u0628 \u0623\u0648 \u0627\u0644\u062C\u062F\u0648\u0644 \u062F\u0648\u0646 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.
    actionPayload: {}`;
    let historyContext = "";
    if (Array.isArray(history) && history.length > 0) {
      historyContext = "\n\u0633\u064A\u0627\u0642 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0628\u064A\u0646 \u0627\u0644\u0645\u0639\u0644\u0645 \u0648\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A:\n" + history.slice(-6).map((m) => `${m.role === "user" ? "\u0627\u0644\u0645\u0639\u0644\u0645" : "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A"}: ${m.content || m.text || ""}`).join("\n");
    }
    let pendingActionContext = "";
    if (pendingAction && typeof pendingAction === "object") {
      pendingActionContext = `
\u0625\u062C\u0631\u0627\u0621 \u0633\u0627\u0628\u0642 \u0645\u0639\u0644\u0642 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u0636\u064A\u062D \u0627\u0644\u0645\u0639\u0644\u0645:
${JSON.stringify(
        pendingAction
      )}
(\u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0625\u062C\u0627\u0628\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0645\u0639\u0644\u0642\u060C \u0642\u0645 \u0628\u062A\u0646\u0641\u064A\u0630\u0647 \u0645\u0628\u0627\u0634\u0631\u0629 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0640 action \u0627\u0644\u0645\u0646\u0627\u0633\u0628!)`;
    }
    const userPromptContent = `
\u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062D\u0627\u0644\u064A \u0641\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629: ${currentTimeStr} (${currentDayAr} - ${currentDayEn})
\u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u062D\u0627\u0644\u064A: ${currentTeacher.name} (${currentTeacher.subject})
\u0637\u0644\u0628 \u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u062D\u0627\u0644\u064A:
"${prompt}"
${historyContext}
${pendingActionContext}

\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629:
- \u0627\u0644\u0641\u0635\u0648\u0644 \u0627\u0644\u0645\u062A\u0627\u062D\u0629: ${JSON.stringify(classesSummary)}
- \u062D\u0635\u0635 \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0646\u0634\u0637\u0629 \u0648\u0633\u062C\u0644 \u0627\u0644\u062D\u0636\u0648\u0631: ${JSON.stringify(sessionsSummary)}
- \u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A: ${JSON.stringify(scheduleSummary)}
- \u0639\u062F\u062F \u0627\u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${studentsBrief.length} \u0637\u0627\u0644\u0628
`;
    const normPrompt = normalizeText2(prompt).toLowerCase();
    let parsedRes = null;
    if (!pendingAction && (normPrompt === "\u0635\u0641\u0631 \u0627\u0644\u062D\u0636\u0648\u0631" || normPrompt === "\u062A\u0635\u0641\u064A\u0631 \u0627\u0644\u062D\u0636\u0648\u0631" || normPrompt === "\u0627\u0645\u0633\u062D \u0627\u0644\u063A\u064A\u0627\u0628" || normPrompt === "\u0635\u0641\u0631 \u0627\u0644\u063A\u064A\u0627\u0628")) {
      parsedRes = {
        message: "\u062A\u0645\u0627\u0645 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u0635\u0641\u0631\u062A\u0644\u0643 \u0633\u062C\u0644 \u0627\u0644\u062D\u0636\u0648\u0631 \u0648\u0627\u0644\u063A\u064A\u0627\u0628 \u0644\u0643\u0644 \u0627\u0644\u062D\u0635\u0635 \u062D\u0627\u0644\u0627 \u0639\u0634\u0627\u0646 \u062A\u0628\u062F\u0623 \u0639\u0644\u0649 \u0646\u0638\u064A\u0641 \u{1F680}",
        action: "RESET_ATTENDANCE",
        actionPayload: {}
      };
    } else if (!pendingAction && (normPrompt === "\u0648\u0644\u062F \u062D\u0635\u0635" || normPrompt === "\u0648\u0644\u062F \u062D\u0635\u0635 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629" || normPrompt === "\u0646\u0632\u0644 \u062C\u062F\u0648\u0644 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629" || normPrompt === "\u062D\u0635\u0635 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629")) {
      parsedRes = {
        message: "\u0623\u0645\u0631\u0643 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u0648\u0644\u0651\u062F\u062A\u0644\u0643 \u0648\u062D\u062F\u062B\u062A\u0644\u0643 \u062D\u0635\u0635 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629 \u0645\u0646 \u062C\u062F\u0648\u0644\u0643 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A \u0641\u0648\u0631\u0627\u064B \u26A1",
        action: "GENERATE_TODAY_SESSIONS",
        actionPayload: {}
      };
    }
    if (!parsedRes) {
      const aiClient = getAiClient();
      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
      let lastErr = null;
      if (aiClient) {
        for (const modelName of candidateModels) {
          try {
            const response = await aiClient.models.generateContent({
              model: modelName,
              contents: userPromptContent,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    message: {
                      type: Type.STRING,
                      description: "\u0631\u062F \u0645\u0628\u0627\u0634\u0631 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u064A\u0634\u0631\u062D \u0645\u0627 \u062A\u0645 \u062A\u0646\u0641\u064A\u0630\u0647 \u0623\u0648 \u064A\u0637\u0631\u062D \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u062A\u0648\u0636\u064A\u062D\u064A \u0644\u0644\u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F \u0628\u062F\u0648\u064A"
                    },
                    action: {
                      type: Type.STRING,
                      description: "\u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0623\u0648 \u0637\u0644\u0628 \u0627\u0644\u062A\u0648\u0636\u064A\u062D",
                      enum: [
                        "UPDATE_SCHEDULE",
                        "GENERATE_TODAY_SESSIONS",
                        "CREATE_SESSION",
                        "UPDATE_SESSION",
                        "UPDATE_CLASS_ZOOM",
                        "DELETE_SESSION",
                        "CLEAR_ALL_SESSIONS",
                        "RESET_ATTENDANCE",
                        "ADD_STUDENT",
                        "DELETE_STUDENT",
                        "UPDATE_STUDENT",
                        "SEND_WHATSAPP",
                        "SET_CLASS_WHATSAPP",
                        "UPDATE_TEACHER_ZOOM",
                        "ASK_CLARIFICATION",
                        "CONFIRM_ACTION",
                        "QUERY_INFO"
                      ]
                    },
                    actionPayload: {
                      type: Type.OBJECT,
                      description: "\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A"
                    },
                    needsClarification: {
                      type: Type.BOOLEAN,
                      description: "\u0647\u0644 \u064A\u062D\u062A\u0627\u062C \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0644\u062A\u0648\u0636\u064A\u062D \u0623\u0648 \u0625\u062C\u0627\u0628\u0629 \u0645\u0646 \u0627\u0644\u0645\u0639\u0644\u0645 \u0642\u0628\u0644 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u061F"
                    },
                    clarificationQuestion: {
                      type: Type.STRING,
                      description: "\u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u062A\u0648\u0636\u064A\u062D\u064A \u0627\u0644\u0645\u062D\u062F\u062F \u0627\u0644\u0645\u0648\u062C\u0647 \u0644\u0644\u0645\u0639\u0644\u0645 \u0641\u064A \u062D\u0627\u0644 \u0627\u0644\u062D\u0627\u062C\u0629 \u0644\u0641\u0647\u0645 \u0634\u064A\u0621 \u0645\u0639\u064A\u0646"
                    },
                    suggestedAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "\u062E\u064A\u0627\u0631\u0627\u062A \u062A\u0641\u0627\u0639\u0644\u064A\u0629 \u0633\u0631\u064A\u0639\u0629 \u0645\u0642\u062A\u0631\u062D\u0629 \u0644\u0644\u0645\u0639\u0644\u0645 \u0644\u0644\u0636\u063A\u0637 \u0639\u0644\u064A\u0647\u0627 (2 \u0625\u0644\u0649 5 \u062E\u064A\u0627\u0631\u0627\u062A \u0643\u062D\u062F \u0623\u0642\u0635\u0649)"
                    },
                    pendingAction: {
                      type: Type.OBJECT,
                      description: "\u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0645\u0639\u0644\u0642 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0645\u0639\u0644\u0645"
                    }
                  },
                  required: ["message", "action"]
                }
              }
            });
            if (response && response.text) {
              parsedRes = JSON.parse(response.text);
              break;
            }
          } catch (err) {
            lastErr = err;
            console.warn(`Copilot model ${modelName} failed, trying next:`, err?.message || err);
          }
        }
      }
      if (!parsedRes) {
        const classMatch = prompt.match(/(4a|4b|5a|6a|7a|8a|رابع|خامس|سادس|سابع|ثامن)/i);
        const urlMatch = prompt.match(/(https?:\/\/[^\s]+)/i);
        const isTrackArabic = /عربي|عربى/.test(prompt);
        const isTrackEnglish = /لغات|انجليزي|english/i.test(prompt);
        const detectedTrack = isTrackArabic ? "arabic" : isTrackEnglish ? "english" : "all";
        if (/انشئ|إنشاء|اعمل|افتح|بدء|ابدأ|حصة جديدة/.test(prompt)) {
          if (classMatch) {
            parsedRes = {
              message: `\u062A\u0645\u0627\u0645 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u0641\u062A\u062D\u062A\u0644\u0643 \u062D\u0635\u0629 \u062C\u062F\u064A\u062F\u0629 \u0644\u0641\u0635\u0644 ${classMatch[1].toUpperCase()} \u0641\u0648\u0631\u0627\u064B \u{1F680}`,
              action: "CREATE_SESSION",
              actionPayload: {
                className: classMatch[1].toUpperCase(),
                targetTrack: detectedTrack,
                zoomUrl: urlMatch ? urlMatch[1] : void 0
              }
            };
          } else {
            parsedRes = {
              message: "\u0645\u0646 \u0639\u0646\u064A\u0627 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u062A\u062D\u0628 \u0623\u0641\u062A\u062D \u0627\u0644\u062D\u0635\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0644\u0623\u064A \u0641\u0635\u0644\u061F",
              action: "ASK_CLARIFICATION",
              needsClarification: true,
              clarificationQuestion: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0635\u0629 \u0644\u0647 \u0627\u0644\u0622\u0646:",
              suggestedAnswers: ["4A \u0644\u063A\u0627\u062A", "4B \u0639\u0631\u0628\u064A", "5A \u0644\u063A\u0627\u062A", "6A \u0644\u063A\u0627\u062A", "7A \u0644\u063A\u0627\u062A", "8A \u0639\u0631\u0628\u064A"],
              pendingAction: { intent: "CREATE_SESSION" }
            };
          }
        } else if (pendingAction?.intent === "CREATE_SESSION" && classMatch) {
          parsedRes = {
            message: `\u0623\u0645\u0631\u0643 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u0623\u0646\u0634\u0623\u062A\u0644\u0643 \u062D\u0635\u0629 \u0641\u0635\u0644 ${classMatch[1].toUpperCase()} \u0641\u0648\u0631\u0627\u064B \u26A1`,
            action: "CREATE_SESSION",
            actionPayload: {
              className: classMatch[1].toUpperCase(),
              targetTrack: detectedTrack
            }
          };
        } else if (/احذف كل الحصص|امسح كل الحصص/.test(prompt)) {
          parsedRes = {
            message: "\u062A\u0645\u0627\u0645 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u0645\u0633\u062D\u062A\u0644\u0643 \u0643\u0644 \u062D\u0635\u0635 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629 \u0639\u0634\u0627\u0646 \u062A\u0628\u062F\u0623 \u0639\u0644\u0649 \u0646\u0638\u064A\u0641.",
            action: "CLEAR_ALL_SESSIONS",
            actionPayload: {}
          };
        } else if (urlMatch && classMatch) {
          parsedRes = {
            message: `\u062A\u0645\u0627\u0645 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u062D\u062F\u062B\u062A\u0644\u0643 \u0631\u0627\u0628\u0637 \u0632\u0648\u0645 \u0644\u0641\u0635\u0644 ${classMatch[1].toUpperCase()} \u0641\u0648\u0631\u0627\u064B \u{1F517}`,
            action: "UPDATE_CLASS_ZOOM",
            actionPayload: {
              className: classMatch[1].toUpperCase(),
              zoomUrl: urlMatch[1]
            }
          };
        } else {
          parsedRes = {
            message: "\u0623\u0647\u0644\u0627\u064B \u0628\u0643 \u064A\u0627 \u0645\u0633\u062A\u0631 \u0623\u062D\u0645\u062F! \u0642\u0648\u0644\u0644\u064A \u062A\u062D\u0628 \u0623\u0639\u0645\u0644\u0643 \u0625\u064A\u0647 \u062F\u0644\u0648\u0642\u062A\u064A\u061F \u0623\u0642\u062F\u0631 \u0623\u0646\u0634\u0626 \u062D\u0635\u0629\u060C \u0623\u0648 \u0623\u0648\u0644\u062F \u062C\u062F\u0648\u0644 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629\u060C \u0623\u0648 \u0623\u0635\u0641\u0631 \u0627\u0644\u062D\u0636\u0648\u0631\u060C \u0623\u0648 \u0623\u0639\u062F\u0644 \u0631\u0648\u0627\u0628\u0637 \u0632\u0648\u0645.",
            action: "ASK_CLARIFICATION",
            needsClarification: true,
            clarificationQuestion: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0633\u0631\u064A\u0639 \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F\u0647:",
            suggestedAnswers: ["\u0648\u0644\u062F \u062D\u0635\u0635 \u0627\u0644\u0646\u0647\u0627\u0631\u062F\u0629", "\u0635\u0641\u0631 \u0627\u0644\u062D\u0636\u0648\u0631", "\u0627\u0639\u0645\u0644 \u062D\u0635\u0629 \u0644\u0641\u0635\u0644 4A", "\u0627\u0639\u0645\u0644 \u062D\u0635\u0629 \u0644\u0641\u0635\u0644 8A"]
          };
        }
      }
    }
    const action = parsedRes.action || "QUERY_INFO";
    const actionPayload = parsedRes.actionPayload || {};
    let executedDetails = null;
    if (action === "UPDATE_SCHEDULE") {
      const rules = Array.isArray(actionPayload.rules) ? actionPayload.rules : [actionPayload];
      let modifiedCount = 0;
      if (Array.isArray(currentTeacher.weeklySchedule)) {
        currentTeacher.weeklySchedule = currentTeacher.weeklySchedule.map((period) => {
          for (const rule of rules) {
            if (!rule.classPattern) continue;
            const normPattern = normalizeText2(rule.classPattern);
            const normClassName = normalizeText2(period.className);
            const matchesClass = normClassName.includes(normPattern) || normPattern.includes(normClassName) || period.className.toLowerCase().replace(/[^a-z0-9]/g, "").includes(rule.classPattern.toLowerCase().replace(/[^a-z0-9]/g, ""));
            const matchesDay = !rule.dayOfWeek || period.dayOfWeek.toLowerCase() === rule.dayOfWeek.toLowerCase();
            if (matchesClass && matchesDay) {
              modifiedCount++;
              return {
                ...period,
                targetTrack: rule.targetTrack !== void 0 ? rule.targetTrack : period.targetTrack,
                startTime: rule.startTime || period.startTime,
                endTime: rule.endTime || period.endTime
              };
            }
          }
          return period;
        });
      }
      generateDailySessionsForToday();
      saveDatabase();
      broadcastSseEvent({
        type: "TEACHER_SCHEDULE_UPDATED",
        teacherId: currentTeacher.id,
        schedule: currentTeacher.weeklySchedule,
        sessions: db.sessions,
        teachers: db.teachers,
        db
      });
      executedDetails = { modifiedPeriodsCount: modifiedCount, schedule: currentTeacher.weeklySchedule };
    } else if (action === "GENERATE_TODAY_SESSIONS") {
      const created = generateDailySessionsForToday();
      saveDatabase();
      broadcastSseEvent({
        type: "DAILY_SESSIONS_GENERATED",
        sessions: db.sessions,
        db
      });
      executedDetails = { generatedCount: created.length, sessions: db.sessions };
    } else if (action === "CREATE_SESSION") {
      const targetClassName = actionPayload.className || "4A";
      const normClass = normalizeText2(targetClassName);
      const matchedClass = db.classes.find(
        (c) => normalizeText2(c.name).includes(normClass) || normClass.includes(normalizeText2(c.name)) || c.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(targetClassName.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      const effectiveClassId = matchedClass?.id || `class_${Date.now()}`;
      const effectiveClassName = matchedClass?.name || targetClassName;
      const effectiveZoom = actionPayload.zoomUrl || matchedClass?.zoomUrl || currentTeacher.classZoomLinks && currentTeacher.classZoomLinks[effectiveClassId] || "https://zoom.us/join";
      const newSession = {
        id: `ses_ai_${Date.now()}`,
        teacherId: currentTeacher.id,
        classId: effectiveClassId,
        className: effectiveClassName,
        sessionTitle: actionPayload.sessionTitle || `\u062D\u0635\u0629 ${effectiveClassName}`,
        zoomUrl: effectiveZoom,
        targetTrack: actionPayload.targetTrack || "all",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        scheduledTime: actionPayload.scheduledTime || "\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0622\u0646",
        isActive: true,
        attendance: []
      };
      db.sessions.unshift(newSession);
      saveDatabase();
      broadcastSseEvent({
        type: "SESSION_CREATED_OR_UPDATED",
        session: newSession,
        sessions: db.sessions,
        db
      });
      executedDetails = { newSession };
    } else if (action === "UPDATE_SESSION") {
      const ident = normalizeText2(actionPayload.sessionIdentifier || "");
      let updatedSession = null;
      db.sessions = db.sessions.map((s) => {
        const normName = normalizeText2(s.className);
        if (s.id === actionPayload.sessionIdentifier || normName.includes(ident) || ident.includes(normName)) {
          updatedSession = {
            ...s,
            zoomUrl: actionPayload.zoomUrl !== void 0 ? actionPayload.zoomUrl : s.zoomUrl,
            sessionTitle: actionPayload.sessionTitle || s.sessionTitle,
            targetTrack: actionPayload.targetTrack || s.targetTrack
          };
          return updatedSession;
        }
        return s;
      });
      if (updatedSession) {
        saveDatabase();
        broadcastSseEvent({
          type: "SESSION_CREATED_OR_UPDATED",
          session: updatedSession,
          sessions: db.sessions,
          db
        });
      }
      executedDetails = { updatedSession };
    } else if (action === "UPDATE_CLASS_ZOOM") {
      const ident = normalizeText2(actionPayload.className || "");
      const newZoom = (actionPayload.zoomUrl || "").trim();
      db.classes = db.classes.map((cls) => {
        const norm = normalizeText2(cls.name);
        if (norm.includes(ident) || ident.includes(norm)) {
          return { ...cls, zoomUrl: newZoom };
        }
        return cls;
      });
      db.sessions = db.sessions.map((s) => {
        const norm = normalizeText2(s.className);
        if (norm.includes(ident) || ident.includes(norm)) {
          return { ...s, zoomUrl: newZoom };
        }
        return s;
      });
      saveDatabase();
      broadcastSseEvent({
        type: "STATE_MUTATED",
        db
      });
      executedDetails = { className: actionPayload.className, zoomUrl: newZoom };
    } else if (action === "DELETE_SESSION") {
      const ident = normalizeText2(actionPayload.sessionIdentifier || "");
      const prevCount = db.sessions.length;
      db.sessions = db.sessions.filter((s) => {
        const normName = normalizeText2(s.className);
        const normTitle = normalizeText2(s.sessionTitle);
        const matches = s.id === actionPayload.sessionIdentifier || normName.includes(ident) || normTitle.includes(ident);
        return !matches;
      });
      saveDatabase();
      broadcastSseEvent({
        type: "STATE_MUTATED",
        db
      });
      executedDetails = { deletedCount: prevCount - db.sessions.length };
    } else if (action === "CLEAR_ALL_SESSIONS") {
      const prevCount = db.sessions.length;
      db.sessions = [];
      saveDatabase();
      broadcastSseEvent({
        type: "SESSIONS_BATCH_DELETED",
        sessionIds: [],
        db
      });
      executedDetails = { clearedSessionsCount: prevCount };
    } else if (action === "RESET_ATTENDANCE") {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const ident = actionPayload.classIdentifier ? normalizeText2(actionPayload.classIdentifier) : "";
      db.sessions = db.sessions.map((s) => {
        if (!ident || normalizeText2(s.className).includes(ident)) {
          return {
            ...s,
            attendance: [],
            lastAttendanceResetAt: nowIso
          };
        }
        return s;
      });
      saveDatabase();
      broadcastSseEvent({
        type: "ATTENDANCE_RESET",
        teacherId: currentTeacher.id,
        sessions: db.sessions,
        db
      });
      executedDetails = { resetAt: nowIso };
    } else if (action === "ADD_STUDENT") {
      const studentName = (actionPayload.name || actionPayload.studentName || "").trim();
      if (studentName) {
        const ident = normalizeText2(actionPayload.className || "");
        const matchedClass = db.classes.find(
          (c) => normalizeText2(c.name).includes(ident) || ident.includes(normalizeText2(c.name))
        ) || db.classes[0];
        const newStudent = {
          id: `st_ai_${Date.now()}`,
          name: studentName,
          classId: matchedClass.id,
          track: actionPayload.track || "english",
          studentCode: actionPayload.studentCode || `ST${Math.floor(1e3 + Math.random() * 9e3)}`
        };
        db.students.push(newStudent);
        saveDatabase();
        broadcastSseEvent({
          type: "STATE_MUTATED",
          db
        });
        executedDetails = { newStudent, class: matchedClass };
      }
    } else if (action === "DELETE_STUDENT") {
      const ident = normalizeText2(actionPayload.studentName || "");
      const prevCount = db.students.length;
      db.students = db.students.filter((st) => {
        const normName = normalizeText2(st.name);
        return !normName.includes(ident) && !ident.includes(normName);
      });
      saveDatabase();
      broadcastSseEvent({
        type: "STATE_MUTATED",
        db
      });
      executedDetails = { deletedStudentsCount: prevCount - db.students.length };
    } else if (action === "UPDATE_STUDENT") {
      const ident = normalizeText2(actionPayload.studentName || "");
      let updatedCount = 0;
      db.students = db.students.map((st) => {
        if (normalizeText2(st.name).includes(ident) || ident.includes(normalizeText2(st.name))) {
          updatedCount++;
          return {
            ...st,
            track: actionPayload.track || st.track
          };
        }
        return st;
      });
      saveDatabase();
      broadcastSseEvent({
        type: "STATE_MUTATED",
        db
      });
      executedDetails = { updatedStudentsCount: updatedCount };
    } else if (action === "SET_CLASS_WHATSAPP") {
      const ident = normalizeText2(actionPayload.className || "");
      const recipient = (actionPayload.recipient || "").trim();
      let matchedClass;
      db.classes = db.classes.map((cls) => {
        if (normalizeText2(cls.name).includes(ident) || ident.includes(normalizeText2(cls.name))) {
          matchedClass = {
            ...cls,
            whatsappRecipient: recipient,
            whatsappRecipientType: actionPayload.recipientType || (recipient.includes("chat.whatsapp.com") ? "group" : "phone")
          };
          return matchedClass;
        }
        return cls;
      });
      saveDatabase();
      broadcastSseEvent({
        type: "STATE_MUTATED",
        db
      });
      executedDetails = { className: actionPayload.className, recipient };
    } else if (action === "UPDATE_TEACHER_ZOOM") {
      const zoomUrl = (actionPayload.zoomUrl || "").trim();
      currentTeacher.defaultZoomLink = zoomUrl;
      saveDatabase();
      broadcastSseEvent({
        type: "STATE_MUTATED",
        db
      });
      executedDetails = { defaultZoomLink: zoomUrl };
    } else if (action === "SEND_WHATSAPP") {
      const ident = normalizeText2(actionPayload.sessionIdentifier || "");
      const targetSession = db.sessions.find(
        (s) => s.id === actionPayload.sessionIdentifier || normalizeText2(s.className).includes(ident)
      );
      if (targetSession) {
        const schoolClass = db.classes.find((c) => c.id === targetSession.classId);
        const recipients = getClassWhatsAppRecipients(schoolClass, currentTeacher);
        if (recipients.length > 0) {
          const rawSavedUrl = db.publishedDomain || "https://zoom2000.vercel.app";
          const appUrl = rawSavedUrl.includes("ais-pre-") || rawSavedUrl.includes("ais-dev-") ? "https://zoom2000.vercel.app" : rawSavedUrl.replace(/\/+$/, "");
          const msgBody = buildWhatsAppReminderMessage({
            session: targetSession,
            schoolClass,
            teacher: currentTeacher,
            appUrl,
            minutesBefore: 0
          });
          for (const r of recipients) {
            await dispatchWhatsAppCloudMessage(r.recipient, msgBody, targetSession.className, currentTeacher.id);
          }
          targetSession.whatsappReminderSent = true;
          targetSession.reminderSentAt = (/* @__PURE__ */ new Date()).toISOString();
          saveDatabase();
          broadcastSseEvent({
            type: "WHATSAPP_REMINDER_SENT",
            sessionId: targetSession.id,
            className: targetSession.className,
            db
          });
          executedDetails = { dispatched: true, session: targetSession };
        }
      }
    } else if (action === "ASK_CLARIFICATION" || action === "CONFIRM_ACTION") {
      executedDetails = { awaitingClarification: true, clarificationQuestion: parsedRes.clarificationQuestion };
    }
    const needsClarification = Boolean(parsedRes.needsClarification || action === "ASK_CLARIFICATION" || action === "CONFIRM_ACTION");
    let suggestedAnswers = Array.isArray(parsedRes.suggestedAnswers) && parsedRes.suggestedAnswers.length > 0 ? parsedRes.suggestedAnswers : [];
    if (needsClarification && suggestedAnswers.length === 0) {
      const pLower = prompt.toLowerCase();
      if (pLower.includes("\u0637\u0627\u0644\u0628") || pLower.includes("\u0636\u064A\u0641")) {
        suggestedAnswers = ["4A \u0644\u063A\u0627\u062A", "4B \u0644\u063A\u0627\u062A", "8A \u0639\u0631\u0628\u064A", "7A \u0644\u063A\u0627\u062A"];
      } else if (pLower.includes("\u062D\u0635\u0629") || pLower.includes("\u0645\u064A\u0639\u0627\u062F") || pLower.includes("\u0648\u0642\u062A") || pLower.includes("\u0632\u0648\u0645")) {
        suggestedAnswers = db.classes.slice(0, 4).map((c) => c.name);
      } else {
        suggestedAnswers = ["\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0641\u0648\u0631\u0627\u064B", "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0623\u0645\u0631"];
      }
    }
    res.json({
      success: true,
      message: parsedRes.message,
      action,
      actionPayload,
      executedDetails,
      needsClarification,
      clarificationQuestion: parsedRes.clarificationQuestion || (needsClarification ? parsedRes.message : ""),
      suggestedAnswers,
      pendingAction: parsedRes.pendingAction || (needsClarification ? actionPayload : null),
      db: {
        sessions: db.sessions,
        teachers: db.teachers,
        classes: db.classes,
        students: db.students,
        lastUpdatedAt: db.lastUpdatedAt
      }
    });
  } catch (err) {
    console.error("AI Copilot error:", err);
    res.status(500).json({
      success: false,
      error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0637\u0644\u0628 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A: " + (err?.message || String(err))
    });
  }
});
app.post("/api/sessions/generate-daily", (_req, res) => {
  for (const id of Array.from(deletedSessionIds)) {
    if (id.startsWith("ses_auto_") || id.startsWith("ses_gen_")) {
      deletedSessionIds.delete(id);
    }
  }
  const createdSessions = generateDailySessionsForToday();
  const activeSessions = db.sessions.filter((s) => s && s.id && !deletedSessionIds.has(s.id));
  db.sessions = activeSessions;
  saveDatabase();
  broadcastSseEvent({
    type: "DAILY_SESSIONS_GENERATED",
    count: createdSessions.length || activeSessions.length,
    sessions: activeSessions,
    lastUpdatedAt: db.lastUpdatedAt,
    db
  });
  res.json({
    success: true,
    count: createdSessions.length || activeSessions.length,
    sessions: activeSessions,
    totalSessions: activeSessions.length
  });
});
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    app.use((req, res, next) => {
      if (!req.path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (mode: ${isProduction ? "prod" : "dev"})`);
  });
}
if (!process.env.VERCEL && !process.env.NOW_REGION) {
  startServer();
}
var server_default = app;
export {
  server_default as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
