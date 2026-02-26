"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickCapture } from "@/components/quick-capture";
import { ActionItemCard } from "@/components/action-item-card";
import { ActionItem } from "@/lib/types";

export default function TodayPage() {
  const [myTasks, setMyTasks] = useState<ActionItem[]>([]);
  const [waitingOn, setWaitingOn] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [fetchData]);

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

      <QuickCapture onCreated={fetchData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              My Tasks ({myTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing on your plate. Nice.
              </p>
            ) : (
              <div className="space-y-2">
                {myTasks.map((item) => (
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
            <CardTitle className="text-lg">
              Waiting On ({waitingOn.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waitingOn.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one owes you anything right now.
              </p>
            ) : (
              <div className="space-y-2">
                {waitingOn.map((item) => (
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
