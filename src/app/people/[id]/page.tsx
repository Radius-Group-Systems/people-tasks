"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickCapture } from "@/components/quick-capture";
import { ActionItemCard } from "@/components/action-item-card";
import { Person, ActionItem, Encounter } from "@/lib/types";

const STATUSES = ["open", "in_progress", "snoozed", "done"] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  snoozed: "Snoozed",
  done: "Done",
};

export default function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [myItemsByStatus, setMyItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [theirItemsByStatus, setTheirItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const fetches = [
        fetch(`/api/people/${id}`),
        fetch(`/api/encounters?person_id=${id}`),
        ...STATUSES.map((s) =>
          fetch(`/api/action-items?person_id=${id}&owner_type=me&status=${s}`)
        ),
        ...STATUSES.map((s) =>
          fetch(`/api/action-items?person_id=${id}&owner_type=them&status=${s}`)
        ),
      ];

      const results = await Promise.all(fetches);
      const jsons = await Promise.all(results.map((r) => r.json()));

      setPerson(jsons[0]);
      setEncounters(jsons[1]);

      const myMap: Record<string, ActionItem[]> = {};
      const theirMap: Record<string, ActionItem[]> = {};
      STATUSES.forEach((s, i) => {
        myMap[s] = jsons[2 + i];
        theirMap[s] = jsons[2 + STATUSES.length + i];
      });
      setMyItemsByStatus(myMap);
      setTheirItemsByStatus(theirMap);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!person) {
    return <div className="text-muted-foreground">Person not found.</div>;
  }

  const myOpenCount = (myItemsByStatus.open || []).length;
  const theirOpenCount = (theirItemsByStatus.open || []).length;

  function renderItemList(items: ActionItem[], emptyMessage: string) {
    if (!items || items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ActionItemCard
            key={item.id}
            item={item}
            onUpdate={fetchData}
            showPerson={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
            {person.organization && <span>{person.organization}</span>}
            {person.email && <span>{person.email}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">
            {myOpenCount} tasks for me
          </Badge>
          <Badge variant="outline">
            {theirOpenCount} waiting on them
          </Badge>
        </div>
      </div>

      <QuickCapture onCreated={fetchData} defaultPersonId={person.id} />

      <Tabs defaultValue="action-items">
        <TabsList>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="encounters">Encounters</TabsTrigger>
        </TabsList>

        <TabsContent value="action-items" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">I need to do</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="open">
                <TabsList>
                  {STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {STATUS_LABELS[s]} ({(myItemsByStatus[s] || []).length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {STATUSES.map((s) => (
                  <TabsContent key={s} value={s} className="mt-3">
                    {renderItemList(
                      myItemsByStatus[s] || [],
                      s === "open"
                        ? `Nothing you owe ${person.name}.`
                        : `No ${STATUS_LABELS[s].toLowerCase()} tasks.`
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {person.name} needs to do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="open">
                <TabsList>
                  {STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {STATUS_LABELS[s]} ({(theirItemsByStatus[s] || []).length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {STATUSES.map((s) => (
                  <TabsContent key={s} value={s} className="mt-3">
                    {renderItemList(
                      theirItemsByStatus[s] || [],
                      s === "open"
                        ? `${person.name} doesn't owe you anything.`
                        : `No ${STATUS_LABELS[s].toLowerCase()} tasks.`
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encounters" className="mt-4">
          {encounters.length === 0 ? (
            <p className="text-muted-foreground">
              No encounters recorded with {person.name} yet.
            </p>
          ) : (
            <div className="space-y-4">
              {encounters.map((enc) => (
                <Card key={enc.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{enc.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(enc.occurred_at).toLocaleDateString()}{" "}
                          &middot; {enc.encounter_type}
                        </p>
                      </div>
                      <Badge variant="outline">{enc.source}</Badge>
                    </div>
                    {enc.summary && (
                      <>
                        <Separator className="my-3" />
                        <p className="text-sm">{enc.summary}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
