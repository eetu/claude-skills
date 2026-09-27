---
name: root-cause
description: How to diagnose a fault without inventing a cause — hold every explanation as a hypothesis with a named falsifying test, prefer the simplest one consistent with ALL the facts, and close an investigation as "cause unknown, facts recorded" when nothing survives. Use whenever something is broken, slow, flaky, or behaving differently than it used to: an incident, a regression, a hang, a failed deploy, a test that fails sometimes. Also use when a fix "seems to work" — that is precisely when coincidence is most likely. Covers the evidence hierarchy, splitting a claim with two vantage points, treating absence of a log as data, and why a recent change is a strong prior but never a proof.
user-invocable: true
---

> **Scope.** Any investigation of a fault, in any system — code, a board, a
> network, a build. The output of an investigation is a set of **facts** plus a
> **verdict on each hypothesis**, not a story. A tidy story is the failure mode
> this skill exists to prevent.

# root-cause

The pressure in an investigation is to produce an explanation, because an
explanation feels like progress and ends the discomfort of not knowing. That
pressure is strongest right after new evidence arrives, and it reliably
manufactures causes that fit the last thing observed and nothing else.

**A cause is a claim about mechanism.** "The board was slow because the card is
worn" is only a cause if worn cards produce that signature and this card is
worn. Until both halves are shown, it is a candidate. Say so in those words.

## The loop

1. **Write the facts down first, with timestamps.** Measurements and log lines,
   no interpretation. A timeline table is the artifact — most contradictions
   become visible the moment two facts sit in adjacent rows.
2. **List every hypothesis that fits the facts.** Plural is the point. One
   hypothesis is not an investigation, it is a conclusion looking for support.
3. **For each, name the measurement that would _reject_ it.** If you cannot
   name one, the hypothesis is not yet a hypothesis.
4. **Run the rejecting test, not the confirming one.** Confirmation is cheap and
   nearly every hypothesis has some evidence for it.
5. **Rank the survivors by Occam's razor** — the simplest mechanism consistent
   with _all_ the facts, not with the most recent one.
6. **Stop when the survivors are one, or say the cause is unknown.** Both are
   legitimate endings. Only one of them is honest when the evidence is thin.

## Occam's razor is a ranking, not a verdict

The razor orders candidates; it does not eliminate them. "Simplest" means fewest
independent things that must all be true — not "most familiar", and not "easiest
to explain". A simple hypothesis that contradicts one recorded fact loses to a
more complex one that fits every fact. Contradicting evidence outranks elegance,
always.

## Coincidence is the default suspect

**"It got better after I did X" is not evidence that X worked.** Systems recover
on their own: a queue drains, a retry succeeds, a cache warms, a storm ends
because it ran out of work. Before crediting a fix, one of these must hold:

- **Mechanism** — you can state why X causes the improvement, specifically.
- **Reproduction** — undoing X brings the fault back, and redoing X removes it.
- **Counterfactual** — the fault persisted through everything _except_ X.

Absent all three, record it as "improved after X, causality unestablished". A
fix credited by coincidence is worse than no fix: it closes the investigation
and leaves the real cause armed.

## A recent change is a strong prior and never a proof

"It worked for weeks, then we changed things, now it is broken" is the single
most valuable signal available, and it is still only a prior. Test it the same
way as anything else — establish what the change actually does, and whether the
signature matches. A change can be innocent and adjacent; an unrelated cause can
arrive the same afternoon. Both happen often enough that neither may be assumed.

The converse error is worse and more common: dismissing the change-correlation
because you authored the change and have a tidier story. **When a hypothesis
would exonerate your own work, raise the evidence bar, not lower it.**

## The evidence hierarchy

Not all observations answer the same question. Ranked by what they can settle:

| Evidence                               | Settles                                 |
| -------------------------------------- | --------------------------------------- |
| A measurement with a number and a unit | the most                                |
| A log line with a timestamp            | what happened, and when                 |
| Absence of an expected log line        | that the thing never reached that stage |
| A reproduction                         | mechanism                               |
| "It seems slower"                      | nothing, until measured                 |

**Absence is data.** A recorder that writes at the end of a phase, and has not
written, proves the phase never completed — often more precisely than anything
present in the logs.

**Know which layer answered you.** A host that replies to ping and accepts TCP
has proved its _kernel_ is alive and nothing about userspace: a listening socket
accepts connections from the backlog whether or not any process is still serving
it. Choose probes that exercise the layer you are asking about.

## Split the claim with two vantage points

The fastest way to halve a search space is to measure the same thing from two
places and see whether they agree. Same test from a second host separates "the
service is down" from "this machine cannot reach it". Same test at a second time
separates "broken" from "flaky". Same test on a second device separates "the
hardware" from "the workload". One extra measurement, half the remaining space.

## One device, several questions

A component is not fast or slow; it is fast or slow **at a specific operation**.
Storage is the common trap: sequential read, sequential write and small random
write are three different numbers with three different failure modes, and a
device can be healthy in two and hopeless in the third. Measure the operation
the workload actually performs, not the one that is easy to measure.

## Closing as unknown

An investigation that ends "cause unresolved" is complete if it records:

- the facts, with timestamps and numbers;
- each hypothesis, and for the rejected ones, the evidence that rejected them;
- the measurement that _would_ have settled it, and why it was unavailable —
  usually because the evidence was volatile and is now gone;
- what to capture next time so the same question is answerable.

That last point is the real deliverable of an unresolved incident: the
instrumentation gap it exposed. A journal held only in RAM, a console nobody can
attach, a status that cannot distinguish "working" from "retrying" — each is a
reason an investigation had to end in a shrug, and each is fixable before the
next one.

## Worked example — the shape this takes

A board serving two dozen containers stops answering. It replies to ping and
accepts TCP on every port; no service responds. It had run fine for weeks.

| Hypothesis                                 | Rejecting test                                                            | Outcome                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Storage has failed                         | read the whole device, look for errors                                    | rejected: clean at 33 MB/s                                                   |
| Storage is worn out                        | measure write and small-random-write                                      | rejected: 9.5 MB/s and ~700 IOPS, within spec                                |
| The new image is bad                       | check which image actually booted                                         | rejected: the new one never booted                                           |
| Maintenance ran against a live workload    | prior art — the same operation had run many times before without incident | rejected by the operator's own history                                       |
| The registry it pulls from was unreachable | reproduce the operation under observation                                 | **untested** — the only recorded error is one timeout, and the logs are gone |

Facts that survived: the machine was stalled on I/O 89% of the time; it later
recovered on its own once ~29 image pulls completed; the storage is healthy at
every operation measured.

Conclusion: **cause unknown.** Recovery was self-limiting and no intervention
was shown to have caused it. The instrumentation gaps the incident exposed — a
journal that does not survive a reboot, a machine with no attachable console,
and a progress indicator that cannot distinguish work from retry — are the
actionable output, not a cause.
