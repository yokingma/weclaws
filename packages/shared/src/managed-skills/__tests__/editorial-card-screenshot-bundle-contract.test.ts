import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const MANAGED_SKILLS_ROOT = new URL('../../../../../resources/skills/managed/', import.meta.url);
const SKILL_ROOT = new URL('editorial-card-screenshot/', MANAGED_SKILLS_ROOT);

describe('editorial-card-screenshot bundle contract', () => {
  it('keeps SKILL frontmatter limited to WeClaws-supported metadata', async () => {
    const skillDoc = await readSkillText('SKILL.md');

    expect(skillDoc).toContain('name: editorial-card-screenshot');
    expect(skillDoc).toContain('description:');
    expect(skillDoc).not.toContain('metadata:');
    expect(skillDoc).not.toContain('clawdbot');
  });

  it('documents Browserless as the only supported screenshot backend', async () => {
    const skillDoc = await readSkillText('SKILL.md');

    expect(skillDoc).toContain('BROWSERLESS_API_URL');
    expect(skillDoc).toContain('BROWSERLESS_API_KEY');
    expect(skillDoc).not.toContain('CHROME_BIN');
    expect(skillDoc).not.toContain('trim_card_bottom.sh');
    expect(skillDoc).not.toContain('file://');
  });

  it('ships a capture helper that uses Browserless instead of a local browser binary', async () => {
    const script = await readSkillText('scripts/capture_card.sh');

    expect(script).toContain('BROWSERLESS_API_URL');
    expect(script).toContain('BROWSERLESS_API_KEY');
    expect(script).toContain('/screenshot?token=');
    expect(script).not.toContain('CHROME_BIN');
    expect(script).not.toContain('/Applications/Google Chrome.app');
    expect(script).not.toContain('file://');
  });

  it('is present in the default-sync managed bundle and ships a narrow-screen template fallback', async () => {
    const index = JSON.parse(await readManagedText('index.json')) as {
      skills: Array<{ name: string; defaultSync?: boolean; requires?: { bins?: string[] } }>;
    };
    const manifest = JSON.parse(await readManagedText('manifest.json')) as {
      skills: Array<{ name: string }>;
    };
    const template = await readSkillText('assets/card-template.html');

    const skillEntry = index.skills.find((entry) => entry.name === 'editorial-card-screenshot');

    expect(skillEntry).toMatchObject({
      name: 'editorial-card-screenshot',
      defaultSync: true,
      requires: {
        bins: ['curl', 'python3'],
      },
    });
    expect(manifest.skills.map((entry) => entry.name)).toContain('editorial-card-screenshot');
    expect(template).toContain('--canvas-width');
    expect(template).toContain('--canvas-height');
    expect(template).toMatch(/@media\s*\(max-width:\s*960px\)/);
  });
});

function readManagedText(relativePath: string) {
  return readFile(new URL(relativePath, MANAGED_SKILLS_ROOT), 'utf8');
}

function readSkillText(relativePath: string) {
  return readFile(new URL(relativePath, SKILL_ROOT), 'utf8');
}
