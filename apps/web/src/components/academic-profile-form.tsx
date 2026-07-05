"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import type { AcademicProfile, ProfileSection } from "@/generated/prisma/client";
import { itemsToLines, profileSections } from "@/lib/profile-sections";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AcademicProfileForm({
  profile,
  sections,
  saved = false
}: {
  profile: AcademicProfile;
  sections: ProfileSection[];
  saved?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(saved ? "saved" : "idle");
  const [completeness, setCompleteness] = useState(profile.completeness);
  const sectionByKey = new Map(sections.map((section) => [section.key, section]));

  async function saveNow() {
    if (!formRef.current) {
      return;
    }

    setSaveState("saving");
    const response = await fetch("/api/profile", {
      method: "POST",
      body: new FormData(formRef.current)
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const result = (await response.json()) as { completeness?: number };
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
  }

  function scheduleAutosave() {
    setSaveState("idle");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void saveNow();
    }, 900);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    void saveNow();
  }

  return (
    <form className="profile-form" ref={formRef} onSubmit={handleSubmit} onChange={scheduleAutosave}>
      <div className={`save-alert ${saveState}`}>
        {saveState === "saving"
          ? "Saving..."
          : saveState === "error"
            ? "Could not save. Please check the details."
            : saveState === "saved"
              ? "Profile saved."
              : "Autosave is ready."}
      </div>
      <div className="profile-score">
        <span>Profile completeness</span>
        <strong>{completeness}%</strong>
      </div>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="displayName" defaultValue={profile.displayName} autoComplete="name" required />
        </label>
        <label>
          <span>Academic Title</span>
          <input name="headline" defaultValue={profile.headline} placeholder="Senior Lecturer, Researcher, PhD Candidate" />
        </label>
        <label>
          <span>University / Institution</span>
          <input name="affiliation" defaultValue={profile.affiliation} />
        </label>
        <label>
          <span>Location</span>
          <input name="location" defaultValue={profile.location} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" defaultValue={profile.email} autoComplete="email" />
        </label>
        <label>
          <span>Website</span>
          <input name="websiteUrl" type="url" defaultValue={profile.websiteUrl} />
        </label>
        <label>
          <span>Google Scholar</span>
          <input name="googleScholarUrl" type="url" defaultValue={profile.googleScholarUrl} />
        </label>
        <label>
          <span>ORCID</span>
          <input name="orcidUrl" type="url" defaultValue={profile.orcidUrl} />
        </label>
        <label className="full">
          <span>LinkedIn</span>
          <input name="linkedinUrl" type="url" defaultValue={profile.linkedinUrl} />
        </label>
        <label className="full">
          <span>Short Bio</span>
          <textarea name="bio" defaultValue={profile.bio} rows={4} />
        </label>
        <label className="full">
          <span>Research Summary</span>
          <textarea name="researchSummary" defaultValue={profile.researchSummary} rows={4} />
        </label>
      </div>
      <div className="section-editor-list">
        {profileSections.map((section) => {
          const savedSection = sectionByKey.get(section.key);
          return (
            <fieldset className="section-editor" key={section.key}>
              <legend>{section.title}</legend>
              <label>
                <span>{section.summaryLabel}</span>
                <input name={`${section.key}Summary`} defaultValue={savedSection?.summary ?? ""} />
              </label>
              <label>
                <span>{section.itemsLabel}</span>
                <textarea
                  name={`${section.key}Items`}
                  defaultValue={itemsToLines(savedSection?.items)}
                  rows={4}
                  placeholder="One item per line"
                />
              </label>
            </fieldset>
          );
        })}
      </div>
      <div className="form-actions">
        <button className="primary-action" type="submit">Save Profile</button>
      </div>
    </form>
  );
}
