import { skillNormalizer } from '../skills/skill-dictionary.js';

/** An allowlist: never send CV text, identity, contact details, education or filenames. */
export function toMatchingProfile(candidate: { skills: string[]; yearsOfExperience: number }) {
  return {
    skills: [...new Set(candidate.skills.map((skill) => skillNormalizer.normalize(skill)).filter((skill): skill is string => Boolean(skill)))],
    yearsOfExperience: Math.max(0, Math.min(30, Math.floor(candidate.yearsOfExperience || 0))),
  };
}
