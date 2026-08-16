"use client";

import { useEffect, useRef, useState } from "react";
import type { HintStep, TeachingInsight } from "@/domain/teaching";
import { classificationLabel } from "@/domain/teaching";

export function useLiveAnnouncements(args: {
  visibleInsight: TeachingInsight | null;
  evidenceGameNodeId: string | undefined;
  hint: HintStep | null;
  navMessage: string | null;
  onNavMessageExpire: () => void;
}): {
  coachAnnouncement: string | null;
  hintAnnouncement: string | null;
} {
  const [coachAnnouncement, setCoachAnnouncement] = useState<string | null>(
    null,
  );
  const [hintAnnouncement, setHintAnnouncement] = useState<string | null>(null);
  const lastAnnouncedInsightId = useRef<string | null>(null);
  const lastAnnouncedHintLevel = useRef<number | null>(null);

  useEffect(() => {
    if (!args.visibleInsight) {
      lastAnnouncedInsightId.current = null;
      return;
    }
    const key = `${args.evidenceGameNodeId ?? ""}:${args.visibleInsight.classification}:${args.visibleInsight.explanation.slice(0, 40)}`;
    if (lastAnnouncedInsightId.current === key) return;
    lastAnnouncedInsightId.current = key;
    setCoachAnnouncement(
      `${classificationLabel(args.visibleInsight.classification)}. ${args.visibleInsight.explanation}`,
    );
    const t = setTimeout(() => setCoachAnnouncement(null), 4000);
    return () => clearTimeout(t);
  }, [args.visibleInsight, args.evidenceGameNodeId]);

  useEffect(() => {
    if (!args.hint) {
      lastAnnouncedHintLevel.current = null;
      return;
    }
    if (lastAnnouncedHintLevel.current === args.hint.level) return;
    lastAnnouncedHintLevel.current = args.hint.level;
    setHintAnnouncement(
      args.hint.question
        ? `Hint ${args.hint.level} of 3. ${args.hint.question}`
        : `Hint ${args.hint.level} of 3.`,
    );
    const t = setTimeout(() => setHintAnnouncement(null), 3500);
    return () => clearTimeout(t);
  }, [args.hint]);

  const expireNav = useRef(args.onNavMessageExpire);

  useEffect(() => {
    expireNav.current = args.onNavMessageExpire;
  });

  useEffect(() => {
    if (!args.navMessage) return;
    const id = setTimeout(() => expireNav.current(), 2500);
    return () => clearTimeout(id);
  }, [args.navMessage]);

  return { coachAnnouncement, hintAnnouncement };
}
