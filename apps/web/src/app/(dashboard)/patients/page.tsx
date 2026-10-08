"use client";

import type { PatientListItem } from "@antigravity-project-spec-pack/domain/api";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Button,
  ButtonLink,
  Chip,
  cx,
  EmptyState,
  ErrorNote,
  inputCls,
  PageHeader,
  PageSkeleton,
  StatusBadge,
} from "../../../components/ui";
import {
  ageOf,
  daysFromToday,
  relativeDay,
  SEX_NAME,
  shortDate,
} from "../../../lib/format";
import {
  prefetchPatient,
  usePatientCounts,
  usePatients,
  type PatientFilters,
} from "../../../lib/queries";

const SORTS: { value: PatientFilters["sort"]; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "nextVisit", label: "Next visit soonest" },
  { value: "lastVisit", label: "Seen most recently" },
];

function PatientsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();

  // Filters live in the URL, so Back returns to the same search.
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = (params.get("status") ?? "") as PatientFilters["status"];
  const sort = (params.get("sort") ?? "recent") as PatientFilters["sort"];
  const deferredQ = useDeferredValue(q);
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(deferredQ), 250);
    return () => clearTimeout(t);
  }, [deferredQ]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedQ) setParam("q", debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the debounced text changes
  }, [debouncedQ]);

  const filters: PatientFilters = { q: debouncedQ, status, sort };
  const list = usePatients(filters);
  const counts = usePatientCounts();
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

  // Load the next page when the end of the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !list.hasNextPage) return;
    const io = new IntersectionObserver(
      ([e]) =>
        e?.isIntersecting &&
        !list.isFetchingNextPage &&
        void list.fetchNextPage(),
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.hasNextPage, list.isFetchingNextPage, list]);

  const chip = (value: PatientFilters["status"], label: string, n?: number) => (
    <Chip
      key={value || "all"}
      selected={status === value}
      onClick={() => setParam("status", status === value ? "" : value)}
    >
      {label}
      {n !== undefined ? ` · ${n}` : ""}
    </Chip>
  );

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={counts.data ? `${counts.data.all} patients` : " "}
        actions={
          <ButtonLink href="/registration" icon={UserPlus}>
            Register patient
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block lg:w-80">
          <span className="sr-only">Search patients</span>
          <Search
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            className={cx(inputCls, "pl-9")}
            placeholder="Search name or patient ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {list.isFetching && !list.isFetchingNextPage ? (
            <Loader2
              size={15}
              className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-muted"
              aria-label="Searching"
            />
          ) : null}
        </label>
        <div className="flex flex-1 flex-wrap gap-2">
          {chip("", "All", counts.data?.all)}
          {chip("overdue", "Overdue", counts.data?.overdue)}
          {chip("review", "Needs review", counts.data?.review)}
          {chip("healing", "Healing", counts.data?.healing)}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) =>
              setParam(
                "sort",
                e.target.value === "recent" ? "" : e.target.value,
              )
            }
            className="h-9 rounded-lg border border-hairline bg-surface px-2 text-sm text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.isPending ? (
        <PageSkeleton rows={8} />
      ) : list.isError ? (
        <ErrorNote error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <div
          className={cx(
            "overflow-hidden rounded-2xl border border-hairline bg-surface transition-opacity",
            list.isPlaceholderData && "opacity-60",
          )}
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={q || status ? "No patients match" : "No patients yet"}
              body={
                q || status
                  ? "Try a different name, ID or filter."
                  : "Register the first patient to get started."
              }
            />
          ) : (
            <>
              {/* Phones: one card per patient. */}
              <ul className="divide-y divide-hairline md:hidden">
                {rows.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/patients/${p.id}`}
                      onTouchStart={() => void prefetchPatient(qc, p.id)}
                      className="flex items-center gap-3 px-4 py-3 active:bg-surface-alt"
                    >
                      <Avatar name={`${p.firstName} ${p.lastName}`} size={38} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate font-medium">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="truncate text-[12px] text-muted">
                          {p.patientId} · {ageOf(p) ?? "—"} ·{" "}
                          {SEX_NAME[p.sex] ?? p.sex}
                        </div>
                        <div className="truncate text-[12px] text-ink-soft">
                          {p.woundSummary ?? "No open wound"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={p.status} />
                        {p.nextVisitDue ? (
                          <span className="text-[11px] text-muted">
                            Next {relativeDay(p.nextVisitDue).toLowerCase()}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-hairline text-[12px] text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Patient</th>
                      <th className="px-4 py-3 font-medium">Age · sex</th>
                      <th className="px-4 py-3 font-medium">Wound</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Last visit</th>
                      <th className="px-4 py-3 font-medium">Next visit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {rows.map((p) => (
                      <Row
                        key={p.id}
                        p={p}
                        onHover={() => void prefetchPatient(qc, p.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div ref={sentinel} />
          {list.hasNextPage ? (
            <div className="flex justify-center border-t border-hairline p-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

function Row({ p, onHover }: { p: PatientListItem; onHover: () => void }) {
  const name = `${p.firstName} ${p.lastName}`;
  const age = ageOf(p);
  const overdue = p.nextVisitDue && daysFromToday(p.nextVisitDue) < 0;
  const href = `/patients/${p.id}`;
  return (
    <tr
      className="relative cursor-pointer transition-colors hover:bg-surface-alt"
      onMouseEnter={onHover}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} size={34} />
          <div className="leading-tight">
            {/* The link covers the whole row (keyboard and middle-click work as on any link). */}
            <Link
              href={href}
              className="font-medium after:absolute after:inset-0"
              onFocus={onHover}
            >
              {name}
            </Link>
            <div className="text-[12px] text-muted">{p.patientId}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-soft">
        {age ?? "—"} · {SEX_NAME[p.sex] ?? p.sex}
      </td>
      <td className="px-4 py-3">
        <div className="max-w-[260px] truncate text-ink-soft">
          {p.woundSummary ?? "No open wound"}
        </div>
        {p.openWounds > 1 ? (
          <div className="text-[12px] text-muted">+{p.openWounds - 1} more</div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={p.status} />
      </td>
      <td className="px-4 py-3 text-ink-soft tabular">
        {p.lastVisitAt ? shortDate(p.lastVisitAt) : "—"}
      </td>
      <td
        className={cx(
          "px-4 py-3 tabular",
          overdue ? "font-medium text-overdue" : "text-ink-soft",
        )}
      >
        {p.nextVisitDue ? relativeDay(p.nextVisitDue) : "—"}
      </td>
    </tr>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <PatientsList />
    </Suspense>
  );
}
