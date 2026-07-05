import type { AcademicProfile } from "@/generated/prisma/client";
import { saveAcademicProfile } from "@/app/profile/actions";

export function AcademicProfileForm({ profile }: { profile: AcademicProfile }) {
  return (
    <form className="profile-form" action={saveAcademicProfile}>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="displayName" defaultValue={profile.displayName} autoComplete="name" />
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
      <div className="form-actions">
        <button className="primary-action" type="submit">Save Profile</button>
      </div>
    </form>
  );
}
