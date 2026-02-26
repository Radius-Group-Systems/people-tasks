"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickCapture } from "@/components/quick-capture";
import { ActionItemCard } from "@/components/action-item-card";
import { PersonPicker } from "@/components/person-picker";
import { ActionItem, Person } from "@/lib/types";
import { UsersIcon } from "lucide-react";

export default function TodayPage() {
  const [myTasks, setMyTasks] = useState<ActionItem[]>([]);
  const [waitingOn, setWaitingOn] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [waitingFilter, setWaitingFilter] = useState("all");
  const [tasksFilter, setTasksFilter] = useState("all");
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [myRes, waitRes] = await Promise.all([
        fetch("/api/action-items?owner_type=me&status=open"),
        fetch("/api/action-items?owner_type=them&status=open"),
      ]);
      setMyTasks(await myRes.json());
      setWaitingOn(await waitRes.json());
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Check identity
    const stored = localStorage.getItem("my-person-id");
    setMyPersonId(stored);
    setIdentityChecked(true);
    // Load people for identity picker if needed
    if (!stored) {
      fetch("/api/people")
        .then((r) => r.json())
        .then(setPeople)
        .catch(console.error);
    }
  }, [fetchData]);

  const waitingPeople = useMemo(() => {
    const names = new Set<string>();
    for (const item of waitingOn) {
      if (item.person_name) names.add(item.person_name);
    }
    return Array.from(names).sort();
  }, [waitingOn]);

  const tasksPeople = useMemo(() => {
    const names = new Set<string>();
    for (const item of myTasks) {
      if (item.person_name) names.add(item.person_name);
    }
    return Array.from(names).sort();
  }, [myTasks]);

  const filteredWaiting = waitingFilter === "all"
    ? waitingOn
    : waitingOn.filter((i) => i.person_name === waitingFilter);

  const filteredTasks = tasksFilter === "all"
    ? myTasks
    : tasksFilter === "_none"
      ? myTasks.filter((i) => !i.person_name)
      : myTasks.filter((i) => i.person_name === tasksFilter);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {identityChecked && !myPersonId && people.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 flex items-center gap-3">
            <span className="text-sm font-medium">Which person are you?</span>
            <PersonPicker
              people={people}
              value=""
              onSelect={(id) => {
                localStorage.setItem("my-person-id", id);
                setMyPersonId(id);
                // Reload so nav and all components pick up the identity
                window.location.reload();
              }}
              onPersonCreated={(p) => {
                setPeople((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
              }}
              placeholder="Select yourself..."
              className="w-[200px]"
            />
            <span className="text-xs text-muted-foreground">This personalizes your dropdowns and defaults.</span>
          </CardContent>
        </Card>
      )}

      <QuickCapture onCreated={fetchData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                My Tasks ({filteredTasks.length})
              </CardTitle>
              {tasksPeople.length > 0 && (
                <Select value={tasksFilter} onValueChange={setTasksFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <UsersIcon className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All people</SelectItem>
                    <SelectItem value="_none">Just me</SelectItem>
                    {tasksPeople.map((name) => (
                      <SelectItem key={name} value={name}>
                        For {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing on your plate. Nice.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    onUpdate={fetchData}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Waiting On ({filteredWaiting.length})
              </CardTitle>
              {waitingPeople.length > 0 && (
                <Select value={waitingFilter} onValueChange={setWaitingFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <UsersIcon className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All people</SelectItem>
                    {waitingPeople.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredWaiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one owes you anything right now.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredWaiting.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    onUpdate={fetchData}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
