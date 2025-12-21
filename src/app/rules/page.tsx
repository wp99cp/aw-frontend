"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Settings, CategoryClass } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, MoveRight, FolderTree, Regex } from "lucide-react";

// Tree node structure for display
interface CategoryNode {
    name: string;
    fullPath: string[];
    rules: CategoryClass[];
    children: Map<string, CategoryNode>;
}

// Build tree from flat classes array
function buildCategoryTree(classes: CategoryClass[]): CategoryNode {
    const root: CategoryNode = {
        name: "root",
        fullPath: [],
        rules: [],
        children: new Map(),
    };

    for (const cls of classes) {
        let current = root;
        for (let i = 0; i < cls.name.length; i++) {
            const segment = cls.name[i];
            if (!current.children.has(segment)) {
                current.children.set(segment, {
                    name: segment,
                    fullPath: cls.name.slice(0, i + 1),
                    rules: [],
                    children: new Map(),
                });
            }
            current = current.children.get(segment)!;
        }
        // Add rule to the deepest node
        current.rules.push(cls);
    }

    return root;
}

// Get all unique parent paths for moving
function getAllCategoryPaths(classes: CategoryClass[]): string[][] {
    const paths = new Set<string>();
    for (const cls of classes) {
        // Add all prefixes as potential parents
        for (let i = 1; i <= cls.name.length; i++) {
            paths.add(cls.name.slice(0, i).join(" > "));
        }
    }
    return Array.from(paths)
        .sort()
        .map(p => p.split(" > "));
}

// Count total nested subcategories recursively
function countNestedSubcategories(node: CategoryNode): number {
    let count = node.children.size;
    for (const child of node.children.values()) {
        count += countNestedSubcategories(child);
    }
    return count;
}

export default function RulesPage() {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Edit dialog
    const [editingRule, setEditingRule] = useState<CategoryClass | null>(null);
    const [editRegex, setEditRegex] = useState("");

    // Delete dialog
    const [deletingRule, setDeletingRule] = useState<CategoryClass | null>(null);

    // Add category dialog
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [addParentPath, setAddParentPath] = useState<string[]>([]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryRegex, setNewCategoryRegex] = useState("");

    // Move dialog
    const [movingRule, setMovingRule] = useState<CategoryClass | null>(null);
    const [moveTargetPath, setMoveTargetPath] = useState("");

    // Category Edit Dialog
    const [editingCategory, setEditingCategory] = useState<{ path: string[]; color?: string } | null>(null);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [editCategoryColor, setEditCategoryColor] = useState("");

    // Category Delete Dialog
    const [deletingCategory, setDeletingCategory] = useState<{ path: string[] } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const s = await api.getSettings();
            setSettings(s);
            // Expand first level by default
            const expanded = new Set<string>();
            (s.classes || []).forEach((cls: CategoryClass) => {
                if (cls.name.length > 0) {
                    expanded.add(cls.name[0]);
                }
            });
            setExpandedNodes(expanded);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newSettings: Settings) => {
        try {
            await api.saveSettings(newSettings);
            setSettings(newSettings);
            toast.success("Changes saved");
        } catch {
            toast.error("Failed to save changes");
        }
    };

    const tree = useMemo(() => {
        if (!settings?.classes) return null;
        return buildCategoryTree(settings.classes);
    }, [settings]);

    const allPaths = useMemo(() => {
        if (!settings?.classes) return [];
        return getAllCategoryPaths(settings.classes);
    }, [settings]);

    const toggleNode = (path: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedNodes(newExpanded);
    };

    // Edit rule
    const handleEditOpen = (rule: CategoryClass) => {
        setEditingRule(rule);
        setEditRegex(rule.rule.regex);
    };

    const handleEditSave = () => {
        if (!settings || !editingRule) return;
        const updatedClasses = settings.classes.map(cls =>
            cls.id === editingRule.id
                ? { ...cls, rule: { ...cls.rule, regex: editRegex } }
                : cls
        );
        saveSettings({ ...settings, classes: updatedClasses });
        setEditingRule(null);
    };

    // Delete rule
    const handleDeleteConfirm = () => {
        if (!settings || !deletingRule) return;
        const updatedClasses = settings.classes.filter(cls => cls.id !== deletingRule.id);
        saveSettings({ ...settings, classes: updatedClasses });
        setDeletingRule(null);
    };

    // Add category/subcategory
    const handleAddOpen = (parentPath: string[] = []) => {
        setAddParentPath(parentPath);
        setNewCategoryName("");
        setNewCategoryRegex("");
        setShowAddDialog(true);
    };

    const handleAddSave = () => {
        if (!settings || !newCategoryName.trim()) return;

        const fullPath = [...addParentPath, newCategoryName.trim()];
        const newRule: CategoryClass = {
            id: Date.now(),
            name: fullPath,
            rule: { type: "regex", regex: newCategoryRegex || newCategoryName.trim() },
            data: {}
        };

        const updatedClasses = [...settings.classes, newRule];
        saveSettings({ ...settings, classes: updatedClasses });
        setShowAddDialog(false);

        // Expand parent to show new category
        if (addParentPath.length > 0) {
            const expanded = new Set(expandedNodes);
            addParentPath.forEach((_, i) => {
                expanded.add(addParentPath.slice(0, i + 1).join(" > "));
            });
            setExpandedNodes(expanded);
        }
    };

    // Move subcategory
    const handleMoveOpen = (rule: CategoryClass) => {
        setMovingRule(rule);
        const parentPath = rule.name.slice(0, -1).join(" > ");
        setMoveTargetPath(parentPath || "root");
    };

    const handleMoveSave = () => {
        if (!settings || !movingRule) return;

        const newParentPath = moveTargetPath === "root" ? [] : moveTargetPath.split(" > ");
        const ruleName = movingRule.name[movingRule.name.length - 1];
        const newFullPath = [...newParentPath, ruleName];

        const updatedClasses = settings.classes.map(cls =>
            cls.id === movingRule.id
                ? { ...cls, name: newFullPath }
                : cls
        );

        saveSettings({ ...settings, classes: updatedClasses });
        setMovingRule(null);
    };

    // Category Rename/Color handlers
    const handleEditCategoryOpen = (node: CategoryNode) => {
        // Find existing color. 
        // 1. Check rules at this node
        // 2. If not found, check all rules in subtree
        let existingColor = node.rules.find(r => r.data?.color)?.data?.color;

        if (!existingColor && settings?.classes) {
            const prefix = node.fullPath;
            const subtreeRules = settings.classes.filter(cls =>
                cls.name.length >= prefix.length &&
                prefix.every((seg, i) => cls.name[i] === seg)
            );
            existingColor = subtreeRules.find(r => r.data?.color)?.data?.color;
        }

        setEditingCategory({ path: node.fullPath, color: existingColor });
        setEditCategoryName(node.name);
        setEditCategoryColor(existingColor || "");
    };

    const handleEditCategorySave = () => {
        if (!settings || !editingCategory || !editCategoryName.trim()) return;

        const { path } = editingCategory;
        const newSegmentName = editCategoryName.trim();
        const depth = path.length - 1;

        const updatedClasses = settings.classes.map(cls => {
            // Check if this rule is in the affected subtree
            const matchesPrefix = path.slice(0, depth).every((p, i) => cls.name[i] === p);
            const matchesSegment = cls.name[depth] === path[depth];

            if (matchesPrefix && matchesSegment) {
                const newFullPath = [...cls.name];
                newFullPath[depth] = newSegmentName;

                let newData = { ...cls.data };
                if (editCategoryColor) {
                    // Apply color if it's the exact path OR if the rule doesn't have a color yet
                    // This allows subcategories to keep their specific colors while inheriting from parents
                    if (cls.name.length === path.length || !cls.data.color) {
                        newData.color = editCategoryColor;
                    }
                } else if (cls.name.length === path.length) {
                    // Only clear color if it's the exact path being edited
                    delete newData.color;
                }

                return { ...cls, name: newFullPath, data: newData };
            }
            return cls;
        });

        saveSettings({ ...settings, classes: updatedClasses });
        setEditingCategory(null);
    };

    const handleDeleteCategoryConfirm = () => {
        if (!settings || !deletingCategory) return;

        const { path } = deletingCategory;
        const updatedClasses = settings.classes.filter(cls => {
            // Filter out any rule that has 'path' as a prefix
            if (cls.name.length < path.length) return true;
            return !path.every((seg, i) => cls.name[i] === seg);
        });

        saveSettings({ ...settings, classes: updatedClasses });
        setDeletingCategory(null);
    };

    // Render tree node recursively
    const renderNode = (node: CategoryNode, depth: number = 0): React.ReactNode => {
        const pathKey = node.fullPath.join(" > ");
        const isExpanded = expandedNodes.has(pathKey);
        const hasChildren = node.children.size > 0;
        const hasRules = node.rules.length > 0;
        const hasContent = hasChildren || hasRules; // Can expand if has children OR rules

        return (
            <div key={pathKey || "root"} className={depth > 0 ? "ml-6 border-l border-border/50 pl-4" : ""}>
                {depth > 0 && (
                    <div className="flex items-center gap-2 py-2 group">
                        {hasContent ? (
                            <button
                                onClick={() => toggleNode(pathKey)}
                                className="p-0.5 hover:bg-muted rounded"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                            </button>
                        ) : (
                            <div className="w-5" />
                        )}
                        <span className="font-medium">{node.name}</span>
                        {node.rules.some(r => r.data?.color) && (
                            <div
                                className="w-3 h-3 rounded-full border border-border"
                                style={{ backgroundColor: node.rules.find(r => r.data?.color)?.data?.color }}
                            />
                        )}
                        <Badge variant="secondary" className="text-xs">
                            {node.rules.length} rule{node.rules.length !== 1 ? "s" : ""}
                        </Badge>
                        {node.children.size > 0 && (
                            <Badge variant="outline" className="text-xs">
                                {countNestedSubcategories(node)} sub{countNestedSubcategories(node) !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => handleEditCategoryOpen(node)}
                                title="Edit category"
                            >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => handleAddOpen(node.fullPath)}
                                title="Add subcategory"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Sub
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-destructive hover:text-destructive"
                                onClick={() => setDeletingCategory({ path: node.fullPath })}
                                title="Delete category and all rules"
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                            </Button>
                        </div>
                    </div>
                )}

                {(depth === 0 || isExpanded) && (
                    <>
                        {/* Show rules at this node */}
                        {node.rules.map(rule => (
                            <div
                                key={rule.id}
                                className="flex items-center justify-between py-2 px-3 ml-5 bg-muted/30 rounded-md mb-1 group hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Regex className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <code className="text-sm font-mono truncate">{rule.rule.regex}</code>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleEditOpen(rule)}
                                        title="Edit rule"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    {rule.name.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0"
                                            onClick={() => handleMoveOpen(rule)}
                                            title="Move to different category"
                                        >
                                            <MoveRight className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                        onClick={() => setDeletingRule(rule)}
                                        title="Delete rule"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {/* Render children */}
                        {Array.from(node.children.values()).map(child => renderNode(child, depth + 1))}
                    </>
                )}
            </div>
        );
    };

    if (loading) {
        return <div className="p-8 text-center">Loading rules...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Category Rules</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your activity categorization rules. Rules are matched in order using regex patterns.
                    </p>
                </div>
                <Button onClick={() => handleAddOpen([])}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FolderTree className="h-5 w-5" />
                        Categories & Rules
                    </CardTitle>
                    <CardDescription>
                        {settings?.classes?.length || 0} rules defined. Click on a category to expand/collapse.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tree && tree.children.size > 0 ? (
                        <div className="space-y-1">
                            {Array.from(tree.children.values()).map(child => renderNode(child, 1))}
                        </div>
                    ) : (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <FolderTree className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No categories yet. Add your first category to get started.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Rule Dialog */}
            <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Rule</DialogTitle>
                        <DialogDescription>
                            Modify the regex pattern for: {editingRule?.name.join(" > ")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Regex Pattern</Label>
                            <Input
                                value={editRegex}
                                onChange={(e) => setEditRegex(e.target.value)}
                                placeholder="Enter regex pattern"
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Pattern is matched case-insensitively against app name, window title, and URL.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingRule(null)}>Cancel</Button>
                        <Button onClick={handleEditSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingRule} onOpenChange={(open) => !open && setDeletingRule(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the rule for &quot;{deletingRule?.name.join(" > ")}&quot;.
                            Events previously categorized by this rule will become uncategorized.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add Category Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {addParentPath.length > 0
                                ? `Add Subcategory to "${addParentPath.join(" > ")}"`
                                : "Add New Category"}
                        </DialogTitle>
                        <DialogDescription>
                            Create a new category with a regex pattern to match events.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Category Name</Label>
                            <Input
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="e.g. Programming"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Regex Pattern</Label>
                            <Input
                                value={newCategoryRegex}
                                onChange={(e) => setNewCategoryRegex(e.target.value)}
                                placeholder="e.g. Code|VSCode|IntelliJ"
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty to use the category name as the pattern.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                        <Button onClick={handleAddSave} disabled={!newCategoryName.trim()}>
                            Add Category
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Move Rule Dialog */}
            <Dialog open={!!movingRule} onOpenChange={(open) => !open && setMovingRule(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move Rule</DialogTitle>
                        <DialogDescription>
                            Move &quot;{movingRule?.name[movingRule?.name.length - 1]}&quot; to a different parent category.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>New Parent Category</Label>
                            <Select value={moveTargetPath} onValueChange={setMoveTargetPath}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select parent (or Root for top-level)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="root">Root (Top Level)</SelectItem>
                                    {allPaths
                                        .filter(p => p.join(" > ") !== movingRule?.name.join(" > "))
                                        .map(path => (
                                            <SelectItem key={path.join(" > ")} value={path.join(" > ")}>
                                                {path.join(" > ")}
                                            </SelectItem>
                                        ))
                                    }
                                </SelectContent>
                            </Select>
                        </div>
                        {movingRule && (
                            <div className="p-3 bg-muted rounded-md text-sm">
                                <span className="text-muted-foreground">New path: </span>
                                <span className="font-medium">
                                    {moveTargetPath === "root"
                                        ? movingRule.name[movingRule.name.length - 1]
                                        : `${moveTargetPath} > ${movingRule.name[movingRule.name.length - 1]}`}
                                </span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMovingRule(null)}>Cancel</Button>
                        <Button onClick={handleMoveSave}>Move</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Edit Category Dialog */}
            <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>
                            Rename the category segment and set its color.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Category Name</Label>
                            <Input
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                                placeholder="Rename category..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Category Color</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="color"
                                    value={editCategoryColor || "#3b82f6"}
                                    onChange={(e) => setEditCategoryColor(e.target.value)}
                                    className="w-12 h-10 p-1 rounded-md cursor-pointer"
                                />
                                <Input
                                    value={editCategoryColor}
                                    onChange={(e) => setEditCategoryColor(e.target.value)}
                                    placeholder="#hex color"
                                    className="font-mono flex-1"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Color will be used in the dashboard and timeline visualizations.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                        <Button onClick={handleEditCategorySave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Category Confirmation */}
            <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the category &quot;{deletingCategory?.path.join(" > ")}&quot; and ALL its rules and subcategories.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCategoryConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Everything
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
