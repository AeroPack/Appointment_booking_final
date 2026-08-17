# Container vs GitHub: Complete Change List

## Overview

- **Container image**: `chandan8585/backend:latest` (built Aug 13, 2026)
- **GitHub repo**: `AeroPack/Appointment_booking_final` (1 commit: `bed1d33`)
- **60 files differ** across all modules
- **Total logic diff**: ~15,000+ lines

## How to use this document

The LLM should:
1. Start with the remote `.ts` files from GitHub as the base
2. Apply the logic changes described below
3. Add proper TypeScript type annotations
4. Push to GitHub
5. Rebuild Docker containers

---

## CRITICAL FILE 1: `src/modules/flows/flow.executor.ts`

**This file has the most changes (1498 lines of diff).**

### Feature 1: `interpolate()` function (NEW in container)

The container has a function that replaces `{{variable}}` placeholders with values from session context. This is used in `handleMessage`, `handleInputPrompt`, `handleChoice`, `handleSlotPicker`, and `handleEnd`.

**Add this function** at the top of the file (after imports, before the class):

```typescript
/** Replace {{variable}} placeholders with values from session context. */
function interpolate(text: string, context: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = context[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}
```

### Feature 2: Two new constants (NEW in container)

Add these after `SLOT_MORE_ID`:

```typescript
/** Row id prefix for a selectable date; the remainder is YYYY-MM-DD. */
const DATE_ID_PREFIX = 'date:';

/** Row id that navigates back from time picker to date picker. */
const SLOT_BACK_ID = 'slots:back';
```

### Feature 3: Two-phase slot picker (MAJOR CHANGE)

**Remote (GitHub) has a flat slot list. Container has a two-phase picker: Phase 1 = Date selection, Phase 2 = Time selection.**

#### Remote's `handleSlotPicker` (flat list - WRONG):
```typescript
// Remote shows all slots in a flat list grouped by date
const start = page * SLOT_PAGE_SIZE < slots.length ? page * SLOT_PAGE_SIZE : 0;
const pageSlots = slots.slice(start, start + SLOT_PAGE_SIZE);
const hasMore = slots.length > start + pageSlots.length;
const sections = this.groupSlotsByDate(pageSlots);
```

#### Container's `handleSlotPicker` (two-phase - CORRECT):
```typescript
async handleSlotPicker(node, context, session) {
    const prompt = interpolate(String(node.data.text || 'Please choose a time:'), session.context);
    const daysAhead = Number(node.data.days_ahead ?? 7);
    const page = Number(context.slot_page ?? 0);
    const phase = context.slot_picker_phase || 'date';
    let slots;
    try {
        slots = await this.fetchSlots(session.doctor_id, daysAhead);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not load slots';
        await this.sendOutbound(session, `Sorry, I could not load available times: ${msg}`, 'text', node.id);
        return { action: 'error', message: msg };
    }
    if (slots.length === 0) {
        await this.sendOutbound(session, `Sorry, there are no free appointments in the next ${daysAhead} days. Please try again later.`, 'text', node.id);
        return { action: 'complete' };
    }
    // Phase 1: Date picker
    if (phase === 'date') {
        const dates = this.extractAvailableDates(slots);
        const weeks = this.groupDatesByWeek(dates);
        const allDateRows = weeks.flatMap(w => w.rows);
        const start = page * SLOT_PAGE_SIZE < allDateRows.length ? page * SLOT_PAGE_SIZE : 0;
        const pageRows = allDateRows.slice(start, start + SLOT_PAGE_SIZE);
        const hasMore = allDateRows.length > start + pageRows.length;
        const sections = [];
        for (const week of weeks) {
            const weekRows = pageRows.filter(r => week.rows.some(wr => wr.id === r.id));
            if (weekRows.length > 0) {
                sections.push({ title: week.title, rows: weekRows });
            }
        }
        if (hasMore) {
            sections.push({ rows: [{ id: SLOT_MORE_ID, title: 'Show more days' }] });
        }
        const numbered = pageRows.map((r, i) => `${i + 1}. ${r.title} -- ${r.description}`).join('\n');
        const fallback = hasMore
            ? `${prompt}\n\n${numbered}\n\nReply with a number, or MORE for more dates.`
            : `${prompt}\n\n${numbered}\n\nReply with a number.`;
        await this.sendOutbound(session, fallback, 'choice', node.id, {
            kind: 'list',
            body: prompt,
            button: 'Choose a day',
            sections,
        });
        return { action: 'wait' };
    }
    // Phase 2: Time picker for selected date
    const selectedDate = String(context.slot_selected_date || '');
    const dateSlots = slots.filter(s => s.date === selectedDate);
    if (dateSlots.length === 0) {
        context.slot_picker_phase = 'date';
        context.slot_selected_date = undefined;
        context.slot_page = 0;
        await this.sendOutbound(session, 'Sorry, no times are left for that day. Please pick another date.', 'text', node.id);
        return { action: 'wait' };
    }
    const dateLabel = dateSlots[0].dateLabel;
    const timePrompt = `Available times for ${dateLabel}:`;
    const TIME_PAGE_SIZE = 8;
    const start = page * TIME_PAGE_SIZE < dateSlots.length ? page * TIME_PAGE_SIZE : 0;
    const pageSlots = dateSlots.slice(start, start + TIME_PAGE_SIZE);
    const hasMore = dateSlots.length > start + pageSlots.length;
    const timeRows = pageSlots.map(s => ({
        id: `${SLOT_ID_PREFIX}${s.start}`,
        title: s.timeLabel,
        ...(s.venue ? { description: s.venue } : {}),
    }));
    if (hasMore) {
        timeRows.push({ id: SLOT_MORE_ID, title: 'Show more times' });
    } else {
        timeRows.push({ id: SLOT_BACK_ID, title: 'Back to dates' });
    }
    const sections = [{ rows: timeRows }];
    const numbered = pageSlots.map((s, i) => `${i + 1}. ${s.timeLabel}`).join('\n');
    const moreOrBack = hasMore ? 'MORE for more times' : 'BACK to choose a different date';
    const fallback = `${timePrompt}\n\n${numbered}\n\nReply with a number, or ${moreOrBack}.`;
    await this.sendOutbound(session, fallback, 'choice', node.id, {
        kind: 'list',
        body: timePrompt,
        button: 'View times',
        sections,
    });
    return { action: 'wait' };
}
```

### Feature 4: Two-phase `handleInput` for slot_picker (MAJOR CHANGE)

**Remote's `handleInput` for slot_picker** (flat list):
```typescript
if (node.type === 'slot_picker') {
    const daysAhead = Number(node.data.days_ahead ?? 7);
    const slots = await this.fetchSlots(session.doctor_id, daysAhead);
    const page = Number(session.context.slot_page ?? 0);
    const start = page * SLOT_PAGE_SIZE < slots.length ? page * SLOT_PAGE_SIZE : 0;
    const offered = slots.slice(start, start + SLOT_PAGE_SIZE);
    const resolved = this.resolveSlotInput(input, slots, offered);
    // ... flat list resolution
}
```

**Container's `handleInput` for slot_picker** (two-phase):
```typescript
if (node.type === 'slot_picker') {
    const daysAhead = Number(node.data.days_ahead ?? 7);
    const slots = await this.fetchSlots(session.doctor_id, daysAhead);
    const page = Number(session.context.slot_page ?? 0);
    const phase = session.context.slot_picker_phase || 'date';
    await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: input,
        messageType: 'text',
    });
    // Phase 1: Date selection
    if (phase === 'date') {
        const dates = this.extractAvailableDates(slots);
        const weeks = this.groupDatesByWeek(dates);
        const allDateRows = weeks.flatMap(w => w.rows);
        const start = page * SLOT_PAGE_SIZE < allDateRows.length ? page * SLOT_PAGE_SIZE : 0;
        const offeredDateRows = allDateRows.slice(start, start + SLOT_PAGE_SIZE);
        const offeredDates = offeredDateRows.map(r => {
            const date = r.id.startsWith(DATE_ID_PREFIX) ? r.id.slice(DATE_ID_PREFIX.length) : '';
            return { date };
        });
        const resolved = this.resolveDateInput(input, dates, offeredDates);
        if (!resolved) {
            await this.sendOutbound(session, 'Sorry, I did not recognise that date. Please pick one of the options.', 'text', node.id);
            return this.executeTurn(session, graph);
        }
        if (resolved.kind === 'more') {
            session.context = { ...session.context, slot_page: page + 1 };
            await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
            return this.executeTurn(session, graph);
        }
        session.context = {
            ...session.context,
            slot_picker_phase: 'time',
            slot_selected_date: resolved.date,
            slot_page: 0,
        };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
    }
    // Phase 2: Time selection
    const selectedDate = String(session.context.slot_selected_date || '');
    const dateSlots = slots.filter(s => s.date === selectedDate);
    const TIME_PAGE_SIZE = 8;
    const start = page * TIME_PAGE_SIZE < dateSlots.length ? page * TIME_PAGE_SIZE : 0;
    const offeredSlots = dateSlots.slice(start, start + TIME_PAGE_SIZE);
    const trimmed = input.trim();
    if (trimmed === SLOT_BACK_ID || trimmed.toLowerCase() === 'back') {
        session.context = { ...session.context, slot_picker_phase: 'date', slot_page: 0 };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
    }
    const resolved = this.resolveSlotInput(input, dateSlots, offeredSlots);
    if (!resolved) {
        await this.sendOutbound(session, 'Sorry, I did not recognise that time. Please pick one of the options.', 'text', node.id);
        return this.executeTurn(session, graph);
    }
    if (resolved.kind === 'more') {
        session.context = { ...session.context, slot_page: page + 1 };
        await this.sessionRepo.updateSessionStatus(session.id, 'running', { context: session.context });
        return this.executeTurn(session, graph);
    }
    const edge = graph.edges.find(e => e.source === node.id);
    if (!edge) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
            errorMessage: 'Slot picker node has no outgoing edge',
        });
        return { ...session, status: 'error' };
    }
    session.current_node_id = edge.target;
    session.context = { ...session.context, slot_start: resolved.start, slot_page: 0, slot_picker_phase: undefined, slot_selected_date: undefined };
    session.step_count = await this.sessionRepo.incrementStepCount(session.id);
    return this.executeTurn(session, graph);
}
```

### Feature 5: New helper methods (NEW in container)

Add these methods to the `FlowExecutor` class:

```typescript
/**
 * Extract unique dates from a flat slot list, counting free slots per day.
 */
extractAvailableDates(slots: SlotOption[]) {
    const map = new Map();
    for (const slot of slots) {
        const existing = map.get(slot.date);
        if (existing) {
            existing.count++;
        } else {
            map.set(slot.date, { dateLabel: slot.dateLabel, count: 1 });
        }
    }
    return Array.from(map.entries()).map(([date, { dateLabel, count }]) => ({
        date,
        dateLabel,
        slotCount: count,
    }));
}

/**
 * Group dates into week sections like "1 week (14 Aug to 16 Aug)".
 */
groupDatesByWeek(dates: Array<{ date: string; dateLabel: string; slotCount: number }>) {
    if (dates.length === 0) return [];
    const weeks = [];
    let currentWeek = null;
    let weekNum = 0;
    let lastMonday = null;
    for (const d of dates) {
        const dateObj = new Date(`${d.date}T00:00:00+05:30`);
        const day = dateObj.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(dateObj);
        monday.setDate(monday.getDate() + diff);
        if (!lastMonday || monday.getTime() !== lastMonday.getTime()) {
            weekNum++;
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            const fmtShort = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
            currentWeek = {
                title: `${weekNum} week (${fmtShort(monday)} to ${fmtShort(sunday)})`,
                rows: [],
            };
            weeks.push(currentWeek);
            lastMonday = monday;
        }
        currentWeek.rows.push({
            id: `${DATE_ID_PREFIX}${d.date}`,
            title: d.dateLabel,
            description: `${d.slotCount} slot${d.slotCount > 1 ? 's' : ''}`,
        });
    }
    return weeks;
}

/**
 * Resolve a reply to the date picker into either a chosen date or a page turn.
 */
resolveDateInput(
    input: string,
    availableDates: Array<{ date: string; dateLabel: string; slotCount: number }>,
    offeredDates: Array<{ date: string }>,
): { kind: 'date'; date: string } | { kind: 'more' } | null {
    const trimmed = input.trim();
    if (trimmed === SLOT_MORE_ID || trimmed.toLowerCase() === 'more') {
        return { kind: 'more' };
    }
    if (trimmed.startsWith(DATE_ID_PREFIX)) {
        const date = trimmed.slice(DATE_ID_PREFIX.length);
        return availableDates.some(d => d.date === date) ? { kind: 'date', date } : null;
    }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= offeredDates.length) {
        return { kind: 'date', date: offeredDates[num - 1].date };
    }
    return null;
}
```

### Feature 6: `interpolate()` usage in other handlers

Replace these in the container:

**`handleMessage`** - change:
```typescript
// Remote:
const text = String(node.data.text || '');
// Container:
const text = interpolate(String(node.data.text || ''), session.context);
```

**`handleInputPrompt`** - change:
```typescript
// Remote:
const text = String(node.data.text || '');
// Container:
const text = interpolate(String(node.data.text || ''), session.context);
```

**`handleChoice`** - change:
```typescript
// Remote:
const text = String(node.data.text || '');
// Container:
const text = interpolate(String(node.data.text || ''), session.context);
```

**`handleSlotPicker`** - change:
```typescript
// Remote:
const prompt = String(node.data.text || 'Please choose a time:');
// Container:
const prompt = interpolate(String(node.data.text || 'Please choose a time:'), session.context);
```

**`handleEnd`** - change:
```typescript
// Remote:
if (node.data.message) {
    await this.sendOutbound(session, String(node.data.message), 'text', node.id);
}
// Container:
if (node.data.message) {
    const text = interpolate(String(node.data.message), session.context);
    await this.sendOutbound(session, text, 'text', node.id);
}
```

### Feature 7: Context cleanup on slot selection

In `handleInput` for slot_picker, when a slot is selected, the container clears the phase state:

```typescript
// Container (correct):
session.context = { ...session.context, slot_start: resolved.start, slot_page: 0, slot_picker_phase: undefined, slot_selected_date: undefined };

// Remote (missing cleanup):
session.context = { ...session.context, slot_start: resolved.start, slot_page: 0 };
```

---

## CRITICAL FILE 2: `src/modules/bot/bot.service.ts`

### Change 1: `MAX_RANGE_DAYS`

```typescript
// Remote:
const MAX_RANGE_DAYS = 14;
// Container:
const MAX_RANGE_DAYS = 30;
```

**This is the only logic difference.** The rest is TypeScript type annotations.

---

## CRITICAL FILE 3: `src/modules/bot/bot.types.ts`

**Remote has proper TypeScript interfaces. Container has empty export.**

The remote file is correct. Keep it as-is.

---

## CRITICAL FILE 4: `src/modules/bot/bot.repository.ts`

**Only TypeScript type annotation differences. No logic changes.**

The remote file is correct. Keep it as-is.

---

## ALL OTHER FILES

The remaining files have differences that are **primarily TypeScript type annotations** (container has compiled JS without types, remote has TS with types). The core business logic is the same.

**Files with only type annotation differences** (no logic changes):
- `modules/appointments/*.ts` - Mostly type differences
- `modules/auth/*.ts` - Mostly type differences
- `modules/doctors/*.ts` - Mostly type differences
- `modules/flows/flow.controller.ts` - Mostly type differences
- `modules/flows/flow.repository.ts` - Mostly type differences
- `modules/flows/flow.service.ts` - Mostly type differences
- `modules/flows/flow.session-*.ts` - Mostly type differences
- `modules/flows/flow.webhook-*.ts` - Mostly type differences
- `modules/messages/*.ts` - Mostly type differences
- `modules/settings/*.ts` - Mostly type differences
- `modules/tags/*.ts` - Mostly type differences
- `modules/users/*.ts` - Mostly type differences

**These files should keep the remote TS version** (which has proper types) and only apply the logic changes from the container if any are found.

---

## Summary of Required Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `flows/flow.executor.ts` | MAJOR | Add `interpolate()`, `DATE_ID_PREFIX`, `SLOT_BACK_ID`, two-phase slot picker, `extractAvailableDates()`, `groupDatesByWeek()`, `resolveDateInput()` |
| `bot/bot.service.ts` | MINOR | Change `MAX_RANGE_DAYS` from 14 to 30 |
| All other files | TYPE ONLY | Keep remote TS version, no logic changes needed |

---

## Rebuild Instructions

After pushing to GitHub:

```bash
# 1. Pull the updated code
git pull origin Main

# 2. Rebuild the Docker image
docker build -t chandan8585/backend:latest -f Dockerfile .

# 3. Stop old container
docker stop appointment_booking_backend
docker rm appointment_booking_backend

# 4. Start new container (use the same docker-compose or run command)
docker-compose up -d appointment_booking_backend
```
