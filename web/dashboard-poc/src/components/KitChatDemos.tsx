import type { FormEvent } from 'react';
import { Message, MessageContent } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';

const THREAD = [
  {
    id: 'm1',
    role: 'user' as const,
    text: 'Is the evening session safe to keep open?',
  },
  {
    id: 'm2',
    role: 'assistant' as const,
    text: 'Tick is fine. TPS is holding near 20. MSPT is warm from play + paused Chunky — not a stall.',
  },
  {
    id: 'm3',
    role: 'user' as const,
    text: 'What should I look at first in the Fix queue?',
  },
  {
    id: 'm4',
    role: 'assistant' as const,
    text: 'Disk runway is critical — 71% used, ~11 days left. Then the open entity spike case under Issues.',
  },
  {
    id: 'm5',
    role: 'user' as const,
    text: 'Any backup freshness concern?',
  },
  {
    id: 'm6',
    role: 'assistant' as const,
    text: 'Last full backup is 6h ago (51 GB). Still inside the freshness window — verify integrity when you next rotate.',
  },
  {
    id: 'm7',
    role: 'user' as const,
    text: 'Summarize heat sensors.',
  },
  {
    id: 'm8',
    role: 'assistant' as const,
    text: 'Package 68°C · ambient 32°C · rise +36°C. Within the kit demo envelope; watch package if MSPT climbs with CPU.',
  },
];

const QUESTIONS = [
  {
    name: 'priority',
    required: true,
    prompt: 'What should ops look at next?',
    description: 'Pick a desk focus or write your own.',
    choices: [
      {
        value: 'disk',
        label: 'Disk runway',
        description: 'Storage growth and free space.',
      },
      {
        value: 'mspt',
        label: 'MSPT warm',
        description: 'Tick budget during evening play.',
      },
      {
        value: 'backup',
        label: 'Backup freshness',
        description: 'Last archive age and verify status.',
      },
    ],
    input: { label: 'Other focus', placeholder: 'Describe another focus…' },
  },
  {
    name: 'depth',
    required: false,
    prompt: 'How deep should the brief go?',
    description: 'Skip if you only need the headline.',
    choices: [
      { value: 'glance', label: 'At a glance' },
      { value: 'full', label: 'Full evidence' },
    ],
  },
] as const;

/** Live MessageScroller demo for Kit. */
export function KitMessageScrollerDemo() {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="h-56 border border-border bg-background">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-3 p-3">
            {THREAD.map((m) => (
              <MessageScrollerItem
                key={m.id}
                messageId={m.id}
                scrollAnchor={m.role === 'user'}
              >
                <Message align={m.role === 'user' ? 'end' : 'start'}>
                  <MessageContent
                    className={
                      m.role === 'user'
                        ? 'max-w-[90%] border border-primary/40 bg-primary/15 px-3 py-2 text-sm'
                        : 'max-w-[90%] border border-border bg-card px-3 py-2 text-sm'
                    }
                  >
                    <p className="m-0 wt-meta text-muted-foreground">
                      {m.role === 'user' ? 'Admin' : 'WatchTower'}
                    </p>
                    <p className="mt-1 m-0 leading-relaxed">{m.text}</p>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

/** Live Questionnaire demo for Kit. */
export function KitQuestionnaireDemo() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <Questionnaire items={QUESTIONS} onSubmit={handleSubmit} className="max-w-lg">
      <QuestionnaireProgress />
      {QUESTIONS.map((question) => (
        <QuestionnaireItem
          key={question.name}
          name={question.name}
          required={question.required}
        >
          <QuestionnaireTitle>{question.prompt}</QuestionnaireTitle>
          <QuestionnaireDescription>{question.description}</QuestionnaireDescription>
          <QuestionnaireChoices>
            {question.choices.map((choice) => (
              <QuestionnaireChoice key={choice.value} value={choice.value}>
                <span className="font-medium">{choice.label}</span>
                {'description' in choice && choice.description ? (
                  <span className="text-muted-foreground">{choice.description}</span>
                ) : null}
              </QuestionnaireChoice>
            ))}
            {'input' in question && question.input ? (
              <QuestionnaireInput
                aria-label={question.input.label}
                placeholder={question.input.placeholder}
              />
            ) : null}
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
      ))}
      <QuestionnaireActions>
        <QuestionnairePrevious />
        <QuestionnaireSkip />
        <QuestionnaireNext />
        <QuestionnaireSubmit />
      </QuestionnaireActions>
    </Questionnaire>
  );
}
