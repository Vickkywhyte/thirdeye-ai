'use client'

import { useActionState } from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { updateProfile, type UpdateProfileState } from '@/app/(dashboard)/settings/actions'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

interface SettingsTabsProps {
  user: {
    id: string
    fullName: string
    email: string
    role: string
  }
  org: {
    id: string
    name: string
    slug: string
    retentionDays: number | null
    canUpdateOrg: boolean
  }
}

function ProfileTab({
  user,
}: {
  user: SettingsTabsProps['user']
}) {
  const initialState: UpdateProfileState = {}
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
          <CardDescription>Your identity on this platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="outline" className="capitalize">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Name</CardTitle>
          <CardDescription>Update the name shown across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={user.fullName}
                placeholder="Your full name"
                maxLength={100}
                required
              />
            </div>

            {state.error && (
              <p className="text-xs text-destructive">{state.error}</p>
            )}
            {state.success && (
              <p className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Name updated successfully
              </p>
            )}

            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function OrganisationTab({
  user,
  org,
}: {
  user: SettingsTabsProps['user']
  org: SettingsTabsProps['org']
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation Details</CardTitle>
          <CardDescription>Your organisation's configuration on ThirdEye AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{org.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Slug</span>
            <span className="font-mono text-xs text-muted-foreground">{org.slug}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Your role</span>
            <Badge variant="outline" className="capitalize">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Retention</CardTitle>
          <CardDescription>
            How long investigation data is retained before archival
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Retention period</p>
              <p className="text-xs text-muted-foreground">
                {org.canUpdateOrg
                  ? 'Contact support to change this value'
                  : 'Managed by your organisation admin'}
              </p>
            </div>
            <span className="text-lg font-semibold tabular-nums">
              {org.retentionDays ?? 365}
              <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SettingsTabs({ user, org }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="organisation">Organisation</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab user={user} />
      </TabsContent>

      <TabsContent value="organisation">
        <OrganisationTab user={user} org={org} />
      </TabsContent>
    </Tabs>
  )
}
