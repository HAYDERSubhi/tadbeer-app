// src/components/family/household-manager.tsx
"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import {
    createHousehold,
    joinHouseholdByCode,
    leaveHousehold,
    removeMemberFromHousehold,
} from '@/services/firestore';
import type { Household } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Copy, LogOut, UserMinus, Crown, Plus, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Create or Join panel (when not in a household) ─────────────────────────

function NoHousehold() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [householdName, setHouseholdName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');

    const createMutation = useMutation({
        mutationFn: () =>
            createHousehold(
                user!.uid,
                user!.displayName || 'مستخدم',
                user!.email || '',
                householdName.trim()
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
            queryClient.invalidateQueries({ queryKey: ['household'] });
            toast({ title: 'تم إنشاء حساب العائلة! 🎉' });
        },
        onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
    });

    const joinMutation = useMutation({
        mutationFn: () =>
            joinHouseholdByCode(
                user!.uid,
                user!.displayName || 'مستخدم',
                user!.email || '',
                inviteCode.trim()
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
            queryClient.invalidateQueries({ queryKey: ['household'] });
            toast({ title: 'انضممت إلى العائلة! 👨‍👩‍👧‍👦' });
        },
        onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
    });

    if (mode === 'idle') {
        return (
            <div className="flex flex-col gap-3">
                <Button
                    className="w-full gap-2"
                    onClick={() => setMode('create')}
                >
                    <Plus className="h-4 w-4" />
                    إنشاء حساب عائلي جديد
                </Button>
                <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setMode('join')}
                >
                    <Link2 className="h-4 w-4" />
                    الانضمام برمز دعوة
                </Button>
            </div>
        );
    }

    if (mode === 'create') {
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">اختر اسماً لحساب العائلة (مثلاً: عائلة الأحمد)</p>
                <Input
                    placeholder="اسم العائلة"
                    value={householdName}
                    onChange={e => setHouseholdName(e.target.value)}
                    className="text-right"
                    dir="rtl"
                />
                <div className="flex gap-2">
                    <Button
                        className="flex-1"
                        disabled={!householdName.trim() || createMutation.isPending}
                        onClick={() => createMutation.mutate()}
                    >
                        {createMutation.isPending ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </Button>
                    <Button variant="ghost" onClick={() => setMode('idle')}>إلغاء</Button>
                </div>
            </div>
        );
    }

    // join mode
    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">أدخل رمز الدعوة المكوّن من 6 أحرف الذي أرسله إليك أحد أفراد العائلة</p>
            <Input
                placeholder="مثال: AB3X7K"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="text-center tracking-widest font-mono text-lg"
                maxLength={6}
            />
            <div className="flex gap-2">
                <Button
                    className="flex-1"
                    disabled={inviteCode.trim().length < 6 || joinMutation.isPending}
                    onClick={() => joinMutation.mutate()}
                >
                    {joinMutation.isPending ? 'جارٍ الانضمام...' : 'انضمام'}
                </Button>
                <Button variant="ghost" onClick={() => setMode('idle')}>إلغاء</Button>
            </div>
        </div>
    );
}

// ─── Active household panel ──────────────────────────────────────────────────

function ActiveHousehold({ household }: { household: Household }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const isOwner = household.ownerId === user?.uid;

    const leaveMutation = useMutation({
        mutationFn: () => leaveHousehold(user!.uid, household),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
            queryClient.invalidateQueries({ queryKey: ['household', household.id] });
            toast({ title: isOwner ? 'تم حذف حساب العائلة' : 'غادرت حساب العائلة' });
        },
        onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
    });

    const removeMutation = useMutation({
        mutationFn: (memberUid: string) =>
            removeMemberFromHousehold(user!.uid, household, memberUid),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['household', household.id] });
            toast({ title: 'تم إزالة العضو' });
        },
        onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
    });

    const copyCode = () => {
        navigator.clipboard.writeText(household.inviteCode);
        toast({ title: 'تم نسخ رمز الدعوة! 📋' });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Invite code */}
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <div>
                    <p className="text-xs text-muted-foreground mb-0.5">رمز الدعوة</p>
                    <p className="font-mono text-2xl font-bold tracking-widest text-primary">{household.inviteCode}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={copyCode} title="نسخ">
                    <Copy className="h-5 w-5" />
                </Button>
            </div>

            {/* Members list */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">الأعضاء ({household.members.length})</p>
                {household.members.map(member => (
                    <div key={member.uid} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2">
                            {member.role === 'owner' && <Crown className="h-4 w-4 text-amber-500" />}
                            <div>
                                <p className="text-sm font-medium">{member.displayName}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                        </div>
                        {/* Owner can remove other members */}
                        {isOwner && member.uid !== user?.uid && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8">
                                        <UserMinus className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>إزالة العضو؟</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            هل تريد إزالة {member.displayName} من حساب العائلة؟
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground"
                                            onClick={() => removeMutation.mutate(member.uid)}
                                        >
                                            إزالة
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        {member.uid === user?.uid && (
                            <Badge variant="secondary" className="text-xs">أنت</Badge>
                        )}
                    </div>
                ))}
            </div>

            {/* Leave / Delete */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30">
                        <LogOut className="h-4 w-4" />
                        {isOwner ? 'حذف حساب العائلة' : 'مغادرة حساب العائلة'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isOwner ? 'حذف حساب العائلة؟' : 'مغادرة حساب العائلة؟'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isOwner
                                ? 'سيتم حذف حساب العائلة وإزالة جميع الأعضاء. هذا الإجراء لا يمكن التراجع عنه.'
                                : 'ستعود إلى حسابك الشخصي وستفقد الوصول إلى بيانات العائلة المشتركة.'
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => leaveMutation.mutate()}
                        >
                            {isOwner ? 'حذف' : 'مغادرة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * HouseholdManager
 * @param embedded - when true, renders without the Card wrapper (used inside accordion)
 */
export function HouseholdManager({ embedded = false }: { embedded?: boolean }) {
    const { household, householdId } = useAppData();

    const inner = (
        <>
            {!embedded && (
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">الحساب العائلي</CardTitle>
                    </div>
                    <CardDescription>
                        {householdId
                            ? `عائلة ${household?.name ?? '...'} — شارك بياناتك مع أفراد عائلتك`
                            : 'شارك الميزانية والمصاريف مع أفراد عائلتك'}
                    </CardDescription>
                </CardHeader>
            )}
            <CardContent className={embedded ? 'p-0' : undefined}>
                {household ? (
                    <ActiveHousehold household={household} />
                ) : (
                    <NoHousehold />
                )}
            </CardContent>
        </>
    );

    if (embedded) return <div>{inner}</div>;

    return <Card>{inner}</Card>;
}
