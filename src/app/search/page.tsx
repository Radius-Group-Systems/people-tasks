"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            RAG-powered search coming in Sprint 3. This will let you ask
            natural language questions across all your meetings, tasks, and
            notes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
