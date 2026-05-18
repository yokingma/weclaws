import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const MANAGED_SKILLS_ROOT = new URL('../../../../../resources/skills/managed/', import.meta.url);
const PUBLIC_LARK_SKILLS = [
  'lark-shared',
  'lark-calendar',
  'lark-im',
  'lark-doc',
  'lark-drive',
  'lark-markdown',
  'lark-sheets',
  'lark-slides',
  'lark-base',
  'lark-task',
  'lark-mail',
  'lark-contact',
  'lark-wiki',
  'lark-event',
  'lark-vc',
  'lark-whiteboard',
  'lark-minutes',
  'lark-openapi-explorer',
  'lark-skill-maker',
  'lark-attendance',
  'lark-approval',
  'lark-workflow-meeting-summary',
  'lark-workflow-standup-report',
  'lark-okr',
] as const;

describe('lark skills bundle contract', () => {
  it('ships the public lark bundle in the default-sync managed set', async () => {
    const index = JSON.parse(await readManagedText('index.json')) as {
      skills: Array<{
        defaultSync?: boolean;
        homepage?: string;
        name: string;
        path: string;
        requires?: { bins?: string[] };
        source?: {
          kind?: string;
          path?: string;
          repo?: string;
        };
      }>;
    };
    const manifest = JSON.parse(await readManagedText('manifest.json')) as {
      skills: Array<{ name: string }>;
    };

    const manifestNames = manifest.skills.map((entry) => entry.name);
    const indexNames = index.skills.map((entry) => entry.name);

    for (const name of PUBLIC_LARK_SKILLS) {
      const skillEntry = index.skills.find((entry) => entry.name === name);

      expect(manifestNames).toContain(name);
      expect(skillEntry).toMatchObject({
        defaultSync: true,
        homepage: 'https://www.feishu.cn/feishu-cli',
        name,
        path: name,
        requires: {
          bins: ['lark-cli'],
        },
        source: {
          kind: 'upstream-vendored',
          path: `skills/${name}`,
          repo: 'larksuite/cli',
        },
      });
    }

    expect(manifestNames).not.toContain('lark-vc-agent');
    expect(indexNames).not.toContain('lark-vc-agent');
  });

  it('keeps upstream metadata and companion references/scripts intact', async () => {
    const sharedSkill = await readManagedText('lark-shared/SKILL.md');
    const imSkill = await readManagedText('lark-im/SKILL.md');
    const calendarWorkflow = await readManagedText(
      'lark-calendar/references/lark-calendar-schedule-meeting.md',
    );
    const baseWorkflow = await readManagedText(
      'lark-base/references/lark-base-data-analysis-sop.md',
    );
    const slidesTemplateTool = await readManagedText('lark-slides/scripts/template_tool.py');

    expect(sharedSkill).toContain('name: lark-shared');
    expect(sharedSkill).toMatch(/version:\s+\S+/);
    expect(imSkill).toContain('metadata:');
    expect(imSkill).toContain('cliHelp: "lark-cli im --help"');
    expect(calendarWorkflow.length).toBeGreaterThan(0);
    expect(baseWorkflow.length).toBeGreaterThan(0);
    expect(slidesTemplateTool.length).toBeGreaterThan(0);
  });
});

function readManagedText(relativePath: string) {
  return readFile(new URL(relativePath, MANAGED_SKILLS_ROOT), 'utf8');
}
