'use strict';

var obsidian = require('obsidian');
var view = require('@codemirror/view');
var state = require('@codemirror/state');
var language = require('@codemirror/language');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class ChangelogModal extends obsidian.Modal {
    constructor(plugin, title, content, cb) {
        super(plugin.app);
        this.plugin = plugin;
        this.title = title;
        this.content = content;
        this.cb = cb;
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            this.titleEl.setText(this.title);
            obsidian.MarkdownRenderer.renderMarkdown(this.content, this.contentEl, "", this.plugin);
        });
    }
    onClose() {
        this.cb();
    }
}
function compareReleases(a, b) {
    const [aMajor, aMinor, aPatch] = a.split(".", 3).map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".", 3).map(Number);
    if (aMajor === bMajor) {
        if (aMinor === bMinor) {
            return aPatch - bPatch;
        }
        return aMinor - bMinor;
    }
    return aMajor - bMajor;
}
class ChangelogModalFeature {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
        this.modal = null;
        this.handleClose = () => __awaiter(this, void 0, void 0, function* () {
            if (!this.modal) {
                return;
            }
            this.settings.previousRelease = "4.6.1";
            yield this.settings.save();
        });
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "show-changelog",
                name: "Show Changelog",
                callback: () => this.showModal(),
            });
            const shouldShow = compareReleases("4.6.1", this.settings.previousRelease || "0.0.0") > 0;
            if (!shouldShow) {
                return;
            }
            this.showModal(this.settings.previousRelease);
        });
    }
    showModal(previousRelease = null) {
        const markdown = "## 4.5.0\n\n### Drag-and-Drop (Experimental)\n\nNow you can drag and drop items using your mouse! 🎉\n\nThis feature is experimental and is disabled by default. To enable this feature, open the plugin settings and turn on the `Drag-and-Drop (Experimental)` setting.\n\nIf you find a bug, please report the [issue](https://github.com/vslinko/obsidian-outliner/issues). Leave your other feedback [here](https://github.com/vslinko/obsidian-outliner/discussions/190).\n\n<img src=\"https://raw.githubusercontent.com/vslinko/obsidian-outliner/main/demo3.gif\" style=\"max-width: 100%\" />\n";
        const lines = markdown.split("\n");
        let lastLine = lines.length;
        if (previousRelease) {
            const lastLineFound = lines.findIndex((line) => line.startsWith("#") && line.includes(previousRelease));
            if (lastLineFound >= 0) {
                lastLine = lastLineFound;
            }
        }
        const modalTitle = `Welcome to Obsidian Outliner ${"4.6.1"}`;
        const modalContent = lines
            .slice(0, lastLine)
            .filter((l) => !/^#+\s+\d+\.\d+\.\d+$/.test(l))
            .join("\n")
            .trim();
        if (modalContent.length === 0) {
            return;
        }
        this.modal = new ChangelogModal(this.plugin, modalTitle, modalContent, this.handleClose);
        this.modal.open();
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.modal) {
                return;
            }
            const modal = this.modal;
            this.modal = null;
            modal.close();
        });
    }
}

function recalculateNumericBullets(root) {
    function visit(parent) {
        let index = 1;
        for (const child of parent.getChildren()) {
            if (/\d+\./.test(child.getBullet())) {
                child.replateBullet(`${index++}.`);
            }
            visit(child);
        }
    }
    visit(root);
}

class DeleteAndMergeWithPreviousLineOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.from.ch && cursor.line === l.from.line);
        if (lineNo === 0) {
            this.mergeWithPreviousItem(root, cursor, list);
        }
        else if (lineNo > 0) {
            this.mergeNotes(root, cursor, list, lines, lineNo);
        }
    }
    mergeNotes(root, cursor, list, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        const prevLineNo = lineNo - 1;
        root.replaceCursor({
            line: cursor.line - 1,
            ch: lines[prevLineNo].text.length + lines[prevLineNo].from.ch,
        });
        lines[prevLineNo].text += lines[lineNo].text;
        lines.splice(lineNo, 1);
        list.replaceLines(lines.map((l) => l.text));
    }
    mergeWithPreviousItem(root, cursor, list) {
        if (root.getChildren()[0] === list && list.isEmpty()) {
            return;
        }
        this.stopPropagation = true;
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        const bothAreEmpty = prev.isEmpty() && list.isEmpty();
        const prevIsEmptyAndSameLevel = prev.isEmpty() && !list.isEmpty() && prev.getLevel() == list.getLevel();
        const listIsEmptyAndPrevIsParent = list.isEmpty() && prev.getLevel() == list.getLevel() - 1;
        if (bothAreEmpty || prevIsEmptyAndSameLevel || listIsEmptyAndPrevIsParent) {
            this.updated = true;
            const parent = list.getParent();
            const prevEnd = prev.getLastLineContentEnd();
            if (!prev.getNotesIndent() && list.getNotesIndent()) {
                prev.setNotesIndent(prev.getFirstLineIndent() +
                    list.getNotesIndent().slice(list.getFirstLineIndent().length));
            }
            const oldLines = prev.getLines();
            const newLines = list.getLines();
            oldLines[oldLines.length - 1] += newLines[0];
            const resultLines = oldLines.concat(newLines.slice(1));
            prev.replaceLines(resultLines);
            parent.removeChild(list);
            for (const c of list.getChildren()) {
                list.removeChild(c);
                prev.addAfterAll(c);
            }
            root.replaceCursor(prevEnd);
            recalculateNumericBullets(root);
        }
    }
}

class DeleteAndMergeWithNextLineOperation {
    constructor(root) {
        this.root = root;
        this.deleteAndMergeWithPrevious =
            new DeleteAndMergeWithPreviousLineOperation(root);
    }
    shouldStopPropagation() {
        return this.deleteAndMergeWithPrevious.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.deleteAndMergeWithPrevious.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.to.ch && cursor.line === l.to.line);
        if (lineNo === lines.length - 1) {
            const nextLine = lines[lineNo].to.line + 1;
            const nextList = root.getListUnderLine(nextLine);
            if (!nextList) {
                return;
            }
            root.replaceCursor(nextList.getFirstLineContentStart());
            this.deleteAndMergeWithPrevious.perform();
        }
        else if (lineNo >= 0) {
            root.replaceCursor(lines[lineNo + 1].from);
            this.deleteAndMergeWithPrevious.perform();
        }
    }
}

class DeleteTillLineStartOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => l.from.line === cursor.line);
        lines[lineNo].text = lines[lineNo].text.slice(cursor.ch - lines[lineNo].from.ch);
        list.replaceLines(lines.map((l) => l.text));
        root.replaceCursor(lines[lineNo].from);
    }
}

class DeleteShouldIgnoreBulletsFeature {
    constructor(plugin, settings, ime, obsidian, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.ime = ime;
        this.obsidian = obsidian;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.stickCursor != "never" && !this.ime.isIMEOpened();
        };
        this.deleteAndMergeWithPreviousLine = (editor) => {
            return this.performOperation.performOperation((root) => new DeleteAndMergeWithPreviousLineOperation(root), editor);
        };
        this.deleteTillLineStart = (editor) => {
            return this.performOperation.performOperation((root) => new DeleteTillLineStartOperation(root), editor);
        };
        this.deleteAndMergeWithNextLine = (editor) => {
            return this.performOperation.performOperation((root) => new DeleteAndMergeWithNextLineOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Backspace",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.deleteAndMergeWithPreviousLine,
                    }),
                },
                {
                    key: "Delete",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.deleteAndMergeWithNextLine,
                    }),
                },
                {
                    mac: "m-Backspace",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.deleteTillLineStart,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function foldInside(view, from, to) {
    let found = null;
    language.foldedRanges(view.state).between(from, to, (from, to) => {
        if (!found || found.from > from)
            found = { from, to };
    });
    return found;
}
class MyEditor {
    constructor(e) {
        this.e = e;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.view = this.e.cm;
    }
    getCursor() {
        return this.e.getCursor();
    }
    getLine(n) {
        return this.e.getLine(n);
    }
    lastLine() {
        return this.e.lastLine();
    }
    listSelections() {
        return this.e.listSelections();
    }
    getRange(from, to) {
        return this.e.getRange(from, to);
    }
    replaceRange(replacement, from, to) {
        return this.e.replaceRange(replacement, from, to);
    }
    setSelections(selections) {
        this.e.setSelections(selections);
    }
    setValue(text) {
        this.e.setValue(text);
    }
    getValue() {
        return this.e.getValue();
    }
    offsetToPos(offset) {
        return this.e.offsetToPos(offset);
    }
    posToOffset(pos) {
        return this.e.posToOffset(pos);
    }
    fold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = language.foldable(view.state, l.from, l.to);
        if (!range || range.from === range.to) {
            return;
        }
        view.dispatch({ effects: [language.foldEffect.of(range)] });
    }
    unfold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = foldInside(view, l.from, l.to);
        if (!range) {
            return;
        }
        view.dispatch({ effects: [language.unfoldEffect.of(range)] });
    }
    getAllFoldedLines() {
        const c = language.foldedRanges(this.view.state).iter();
        const res = [];
        while (c.value) {
            res.push(this.offsetToPos(c.from).line);
            c.next();
        }
        return res;
    }
    triggerOnKeyDown(e) {
        view.runScopeHandlers(this.view, e, "editor");
    }
    getZoomRange() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = window.ObsidianZoomPlugin;
        if (!api || !api.getZoomRange) {
            return null;
        }
        return api.getZoomRange(this.e);
    }
    zoomOut() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = window.ObsidianZoomPlugin;
        if (!api || !api.zoomOut) {
            return;
        }
        api.zoomOut(this.e);
    }
    zoomIn(line) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = window.ObsidianZoomPlugin;
        if (!api || !api.zoomIn) {
            return;
        }
        api.zoomIn(this.e, line);
    }
}

class MoveListToDifferentPositionOperation {
    constructor(root, listToMove, placeToMove, whereToMove, defaultIndentChars) {
        this.root = root;
        this.listToMove = listToMove;
        this.placeToMove = placeToMove;
        this.whereToMove = whereToMove;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        if (this.listToMove === this.placeToMove) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursorAnchor = this.calculateCursorAnchor();
        this.moveList();
        this.changeIndent();
        this.restoreCursor(cursorAnchor);
        recalculateNumericBullets(this.root);
    }
    calculateCursorAnchor() {
        const cursorLine = this.root.getCursor().line;
        const lines = [
            this.listToMove.getFirstLineContentStart().line,
            this.listToMove.getLastLineContentEnd().line,
            this.placeToMove.getFirstLineContentStart().line,
            this.placeToMove.getLastLineContentEnd().line,
        ];
        const listStartLine = Math.min(...lines);
        const listEndLine = Math.max(...lines);
        if (cursorLine < listStartLine || cursorLine > listEndLine) {
            return null;
        }
        const cursor = this.root.getCursor();
        const cursorList = this.root.getListUnderLine(cursor.line);
        const cursorListStart = cursorList.getFirstLineContentStart();
        const lineDiff = cursor.line - cursorListStart.line;
        const chDiff = cursor.ch - cursorListStart.ch;
        return { cursorList, lineDiff, chDiff };
    }
    moveList() {
        this.listToMove.getParent().removeChild(this.listToMove);
        switch (this.whereToMove) {
            case "before":
                this.placeToMove
                    .getParent()
                    .addBefore(this.placeToMove, this.listToMove);
                break;
            case "after":
                this.placeToMove
                    .getParent()
                    .addAfter(this.placeToMove, this.listToMove);
                break;
            case "inside":
                this.placeToMove.addBeforeAll(this.listToMove);
                break;
        }
    }
    changeIndent() {
        const oldIndent = this.listToMove.getFirstLineIndent();
        const newIndent = this.whereToMove === "inside"
            ? this.placeToMove.getFirstLineIndent() + this.defaultIndentChars
            : this.placeToMove.getFirstLineIndent();
        this.listToMove.unindentContent(0, oldIndent.length);
        this.listToMove.indentContent(0, newIndent);
    }
    restoreCursor(cursorAnchor) {
        if (cursorAnchor) {
            const cursorListStart = cursorAnchor.cursorList.getFirstLineContentStart();
            this.root.replaceCursor({
                line: cursorListStart.line + cursorAnchor.lineDiff,
                ch: cursorListStart.ch + cursorAnchor.chDiff,
            });
        }
        else {
            // When you move a list, the screen scrolls to the cursor.
            // It is better to move the cursor into the viewport than let the screen scroll.
            this.root.replaceCursor(this.listToMove.getLastLineContentEnd());
        }
    }
}

function cmpPos(a, b) {
    return a.line - b.line || a.ch - b.ch;
}
function maxPos(a, b) {
    return cmpPos(a, b) < 0 ? b : a;
}
function minPos(a, b) {
    return cmpPos(a, b) < 0 ? a : b;
}
function isRangesIntersects(a, b) {
    return cmpPos(a[1], b[0]) >= 0 && cmpPos(a[0], b[1]) <= 0;
}
let idSeq = 0;
class List {
    constructor(root, indent, bullet, optionalCheckbox, spaceAfterBullet, firstLine, foldRoot) {
        this.root = root;
        this.indent = indent;
        this.bullet = bullet;
        this.optionalCheckbox = optionalCheckbox;
        this.spaceAfterBullet = spaceAfterBullet;
        this.foldRoot = foldRoot;
        this.parent = null;
        this.children = [];
        this.notesIndent = null;
        this.lines = [];
        this.id = idSeq++;
        this.lines.push(firstLine);
    }
    getID() {
        return this.id;
    }
    getNotesIndent() {
        return this.notesIndent;
    }
    setNotesIndent(notesIndent) {
        if (this.notesIndent !== null) {
            throw new Error(`Notes indent already provided`);
        }
        this.notesIndent = notesIndent;
    }
    addLine(text) {
        if (this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines.push(text);
    }
    replaceLines(lines) {
        if (lines.length > 1 && this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines = lines;
    }
    getLineCount() {
        return this.lines.length;
    }
    getRoot() {
        return this.root;
    }
    getChildren() {
        return this.children.concat();
    }
    getLinesInfo() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return this.lines.map((row, i) => {
            const line = startLine + i;
            const startCh = i === 0 ? this.getContentStartCh() : this.notesIndent.length;
            const endCh = startCh + row.length;
            return {
                text: row,
                from: { line, ch: startCh },
                to: { line, ch: endCh },
            };
        });
    }
    getLines() {
        return this.lines.concat();
    }
    getFirstLineContentStart() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh(),
        };
    }
    getFirstLineContentStartAfterCheckbox() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh() + this.optionalCheckbox.length,
        };
    }
    getLastLineContentEnd() {
        const endLine = this.root.getContentLinesRangeOf(this)[1];
        const endCh = this.lines.length === 1
            ? this.getContentStartCh() + this.lines[0].length
            : this.notesIndent.length + this.lines[this.lines.length - 1].length;
        return {
            line: endLine,
            ch: endCh,
        };
    }
    getContentEndIncludingChildren() {
        return this.getLastChild().getLastLineContentEnd();
    }
    getLastChild() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let lastChild = this;
        while (!lastChild.isEmpty()) {
            lastChild = lastChild.getChildren().last();
        }
        return lastChild;
    }
    getContentStartCh() {
        return this.indent.length + this.bullet.length + 1;
    }
    isFolded() {
        if (this.foldRoot) {
            return true;
        }
        if (this.parent) {
            return this.parent.isFolded();
        }
        return false;
    }
    isFoldRoot() {
        return this.foldRoot;
    }
    getTopFoldRoot() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let tmp = this;
        let foldRoot = null;
        while (tmp) {
            if (tmp.isFoldRoot()) {
                foldRoot = tmp;
            }
            tmp = tmp.parent;
        }
        return foldRoot;
    }
    getLevel() {
        if (!this.parent) {
            return 0;
        }
        return this.parent.getLevel() + 1;
    }
    unindentContent(from, till) {
        this.indent = this.indent.slice(0, from) + this.indent.slice(till);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, from) + this.notesIndent.slice(till);
        }
        for (const child of this.children) {
            child.unindentContent(from, till);
        }
    }
    indentContent(indentPos, indentChars) {
        this.indent =
            this.indent.slice(0, indentPos) +
                indentChars +
                this.indent.slice(indentPos);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, indentPos) +
                    indentChars +
                    this.notesIndent.slice(indentPos);
        }
        for (const child of this.children) {
            child.indentContent(indentPos, indentChars);
        }
    }
    getFirstLineIndent() {
        return this.indent;
    }
    getBullet() {
        return this.bullet;
    }
    getSpaceAfterBullet() {
        return this.spaceAfterBullet;
    }
    getCheckboxLength() {
        return this.optionalCheckbox.length;
    }
    replateBullet(bullet) {
        this.bullet = bullet;
    }
    getParent() {
        return this.parent;
    }
    addBeforeAll(list) {
        this.children.unshift(list);
        list.parent = this;
    }
    addAfterAll(list) {
        this.children.push(list);
        list.parent = this;
    }
    removeChild(list) {
        const i = this.children.indexOf(list);
        this.children.splice(i, 1);
        list.parent = null;
    }
    addBefore(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i, 0, list);
        list.parent = this;
    }
    addAfter(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i + 1, 0, list);
        list.parent = this;
    }
    getPrevSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i > 0 ? this.children[i - 1] : null;
    }
    getNextSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i >= 0 && i < this.children.length ? this.children[i + 1] : null;
    }
    isEmpty() {
        return this.children.length === 0;
    }
    print() {
        let res = "";
        for (let i = 0; i < this.lines.length; i++) {
            res +=
                i === 0
                    ? this.indent + this.bullet + this.spaceAfterBullet
                    : this.notesIndent;
            res += this.lines[i];
            res += "\n";
        }
        for (const child of this.children) {
            res += child.print();
        }
        return res;
    }
    clone(newRoot) {
        const clone = new List(newRoot, this.indent, this.bullet, this.optionalCheckbox, this.spaceAfterBullet, "", this.foldRoot);
        clone.id = this.id;
        clone.lines = this.lines.concat();
        clone.notesIndent = this.notesIndent;
        for (const child of this.children) {
            clone.addAfterAll(child.clone(newRoot));
        }
        return clone;
    }
}
class Root {
    constructor(start, end, selections) {
        this.start = start;
        this.end = end;
        this.rootList = new List(this, "", "", "", "", "", false);
        this.selections = [];
        this.replaceSelections(selections);
    }
    getRootList() {
        return this.rootList;
    }
    getRange() {
        return [Object.assign({}, this.start), Object.assign({}, this.end)];
    }
    getSelections() {
        return this.selections.map((s) => ({
            anchor: Object.assign({}, s.anchor),
            head: Object.assign({}, s.head),
        }));
    }
    hasSingleCursor() {
        if (!this.hasSingleSelection()) {
            return false;
        }
        const selection = this.selections[0];
        return (selection.anchor.line === selection.head.line &&
            selection.anchor.ch === selection.head.ch);
    }
    hasSingleSelection() {
        return this.selections.length === 1;
    }
    getSelection() {
        const selection = this.selections[this.selections.length - 1];
        const from = selection.anchor.ch > selection.head.ch
            ? selection.head.ch
            : selection.anchor.ch;
        const to = selection.anchor.ch > selection.head.ch
            ? selection.anchor.ch
            : selection.head.ch;
        return Object.assign(Object.assign({}, selection), { from,
            to });
    }
    getCursor() {
        return Object.assign({}, this.selections[this.selections.length - 1].head);
    }
    replaceCursor(cursor) {
        this.selections = [{ anchor: cursor, head: cursor }];
    }
    replaceSelections(selections) {
        if (selections.length < 1) {
            throw new Error(`Unable to create Root without selections`);
        }
        this.selections = selections;
    }
    getListUnderCursor() {
        return this.getListUnderLine(this.getCursor().line);
    }
    getListUnderLine(line) {
        if (line < this.start.line || line > this.end.line) {
            return;
        }
        let result = null;
        let index = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = index;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (line >= listFromLine && line <= listTillLine) {
                    result = l;
                }
                else {
                    index = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getContentLinesRangeOf(list) {
        let result = null;
        let line = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = line;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (l === list) {
                    result = [listFromLine, listTillLine];
                }
                else {
                    line = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getChildren() {
        return this.rootList.getChildren();
    }
    print() {
        let res = "";
        for (const child of this.rootList.getChildren()) {
            res += child.print();
        }
        return res.replace(/\n$/, "");
    }
    clone() {
        const clone = new Root(Object.assign({}, this.start), Object.assign({}, this.end), this.getSelections());
        clone.rootList = this.rootList.clone(clone);
        return clone;
    }
}

class DragAndDropFeature {
    constructor(plugin, settings, obisidian, parser, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.obisidian = obisidian;
        this.parser = parser;
        this.performOperation = performOperation;
        this.state = null;
        this.handleMouseDown = (e) => {
            if (!isFeatureSupported() ||
                !this.settings.dndExperiment ||
                !isClickOnBullet(e)) {
                return;
            }
            const view = getEditorViewFromHTMLElement(e.target);
            if (!view) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.startDragging(e.x, e.y, view);
        };
        this.handleMouseMove = (e) => {
            if (this.state) {
                this.detectAndDrawDropZone(e.x, e.y);
            }
        };
        this.handleMouseUp = () => {
            if (this.state) {
                this.stopDragging();
            }
        };
        this.handleKeyDown = (e) => {
            if (this.state && e.code === "Escape") {
                this.cancelDragging();
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(dndStateField);
            this.enableFeatureToggle();
            this.createDropZone();
            this.addEventListeners();
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.removeEventListeners();
            this.removeDropZone();
            this.disableFeatureToggle();
        });
    }
    enableFeatureToggle() {
        this.settings.onChange("dndExperiment", this.handleSettingsChange);
        this.handleSettingsChange(this.settings.dndExperiment);
    }
    disableFeatureToggle() {
        this.settings.removeCallback("dndExperiment", this.handleSettingsChange);
        this.handleSettingsChange(false);
    }
    createDropZone() {
        this.dropZone = document.createElement("div");
        this.dropZone.classList.add("outliner-plugin-drop-zone");
        this.dropZone.style.display = "none";
        document.body.appendChild(this.dropZone);
    }
    removeDropZone() {
        document.body.removeChild(this.dropZone);
        this.dropZone = null;
    }
    addEventListeners() {
        document.addEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
        document.addEventListener("keydown", this.handleKeyDown);
    }
    removeEventListeners() {
        document.removeEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
        document.removeEventListener("keydown", this.handleKeyDown);
    }
    handleSettingsChange(dndExperiment) {
        if (!isFeatureSupported()) {
            return;
        }
        if (dndExperiment) {
            document.body.classList.add("outliner-plugin-dnd");
        }
        else {
            document.body.classList.remove("outliner-plugin-dnd");
        }
    }
    startDragging(x, y, view) {
        const editor = new MyEditor(view.state.field(obsidian.editorInfoField).editor);
        const pos = editor.offsetToPos(view.posAtCoords({ x, y }));
        const root = this.parser.parse(editor, pos);
        const list = root.getListUnderLine(pos.line);
        const state = new DragAndDropState(view, editor, root, list);
        if (!state.hasDropVariants()) {
            return;
        }
        this.state = state;
        this.highlightDraggingLines();
        this.detectAndDrawDropZone(x, y);
    }
    detectAndDrawDropZone(x, y) {
        this.state.calculateNearestDropVariant(x, y);
        this.drawDropZone();
    }
    cancelDragging() {
        this.state.dropVariant = null;
        this.stopDragging();
    }
    stopDragging() {
        this.unhightlightDraggingLines();
        this.hideDropZone();
        this.applyChanges();
        this.state = null;
    }
    applyChanges() {
        if (!this.state.dropVariant) {
            return;
        }
        const { state } = this;
        const { dropVariant, editor, root, list } = state;
        const newRoot = this.parser.parse(editor, root.getRange()[0]);
        if (!isSameRoots(root, newRoot)) {
            new obsidian.Notice(`The item cannot be moved. The page content changed during the move.`, 5000);
            return;
        }
        this.performOperation.evalOperation(root, new MoveListToDifferentPositionOperation(root, list, dropVariant.placeToMove, dropVariant.whereToMove, this.obisidian.getDefaultIndentChars()), editor);
    }
    highlightDraggingLines() {
        const { state } = this;
        const { list, editor, view } = state;
        const lines = [];
        const fromLine = list.getFirstLineContentStart().line;
        const tillLine = list.getContentEndIncludingChildren().line;
        for (let i = fromLine; i <= tillLine; i++) {
            lines.push(editor.posToOffset({ line: i, ch: 0 }));
        }
        view.dispatch({
            effects: [dndStarted.of(lines)],
        });
        document.body.classList.add("outliner-plugin-dragging");
    }
    unhightlightDraggingLines() {
        document.body.classList.remove("outliner-plugin-dragging");
        this.state.view.dispatch({
            effects: [dndEnded.of()],
        });
    }
    drawDropZone() {
        const { state } = this;
        const { view, editor, list, dropVariant } = state;
        const width = Math.round(view.contentDOM.offsetWidth -
            (dropVariant.left -
                view.coordsAtPos(editor.posToOffset({
                    line: list.getFirstLineContentStart().line,
                    ch: 0,
                })).left));
        this.dropZone.style.display = "block";
        this.dropZone.style.top = dropVariant.top + "px";
        this.dropZone.style.left = dropVariant.left + "px";
        this.dropZone.style.width = width + "px";
        if (dropVariant.whereToMove === "before" &&
            !this.dropZone.classList.contains("outliner-plugin-drop-zone-before")) {
            this.dropZone.classList.remove("outliner-plugin-drop-zone-after");
            this.dropZone.classList.add("outliner-plugin-drop-zone-before");
        }
        else if ((dropVariant.whereToMove === "after" ||
            dropVariant.whereToMove === "inside") &&
            !this.dropZone.classList.contains("outliner-plugin-drop-zone-after")) {
            this.dropZone.classList.remove("outliner-plugin-drop-zone-before");
            this.dropZone.classList.add("outliner-plugin-drop-zone-after");
        }
    }
    hideDropZone() {
        this.dropZone.style.display = "none";
    }
}
class DragAndDropState {
    constructor(view, editor, root, list) {
        this.view = view;
        this.editor = editor;
        this.root = root;
        this.list = list;
        this.dropVariants = new Map();
        this.dropVariant = null;
        this.collectDropVariants();
    }
    getDropVariants() {
        return Array.from(this.dropVariants.values());
    }
    hasDropVariants() {
        return this.dropVariants.size > 0;
    }
    calculateNearestDropVariant(x, y) {
        const { view, editor } = this;
        this.dropVariant = this.getDropVariants()
            .map((v) => {
            const { placeToMove } = v;
            switch (v.whereToMove) {
                case "before":
                case "after":
                    v.left = Math.round(view.coordsAtPos(editor.posToOffset({
                        line: placeToMove.getFirstLineContentStart().line,
                        ch: placeToMove.getFirstLineIndent().length,
                    })).left);
                    break;
                case "inside":
                    v.left = Math.round(view.coordsAtPos(editor.posToOffset({
                        line: placeToMove.getFirstLineContentStart().line,
                        ch: placeToMove.getFirstLineIndent().length,
                    })).left +
                        view.defaultCharacterWidth * 2);
                    break;
            }
            switch (v.whereToMove) {
                case "before":
                    v.top = Math.round(view.coordsAtPos(editor.posToOffset(placeToMove.getFirstLineContentStart())).top);
                    break;
                case "after":
                case "inside":
                    v.top = Math.round(view.coordsAtPos(editor.posToOffset(placeToMove.getContentEndIncludingChildren())).top + view.defaultLineHeight);
                    break;
            }
            return v;
        })
            .sort((a, b) => {
            if (a.top === b.top) {
                return Math.abs(x - a.left) - Math.abs(x - b.left);
            }
            return Math.abs(y - a.top) - Math.abs(y - b.top);
        })
            .first();
    }
    addDropVariant(v) {
        this.dropVariants.set(`${v.line} ${v.level}`, v);
    }
    collectDropVariants() {
        const visit = (lists) => {
            for (const placeToMove of lists) {
                const lineBefore = placeToMove.getFirstLineContentStart().line;
                const lineAfter = placeToMove.getContentEndIncludingChildren().line + 1;
                const level = placeToMove.getLevel();
                this.addDropVariant({
                    line: lineBefore,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "before",
                });
                this.addDropVariant({
                    line: lineAfter,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "after",
                });
                if (placeToMove.isEmpty()) {
                    this.addDropVariant({
                        line: lineAfter,
                        level: level + 1,
                        left: 0,
                        top: 0,
                        placeToMove,
                        whereToMove: "inside",
                    });
                }
                if (placeToMove !== this.list) {
                    visit(placeToMove.getChildren());
                }
            }
        };
        visit(this.root.getChildren());
    }
}
const dndStarted = state.StateEffect.define({
    map: (lines, change) => lines.map((l) => change.mapPos(l)),
});
const dndEnded = state.StateEffect.define();
const draggingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dragging-line",
});
const dndStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndState, tr) => {
        dndState = dndState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndStarted)) {
                dndState = dndState.update({
                    add: e.value.map((l) => draggingLineDecoration.range(l, l)),
                });
            }
            if (e.is(dndEnded)) {
                dndState = view.Decoration.none;
            }
        }
        return dndState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
function getEditorViewFromHTMLElement(e) {
    while (e && !e.classList.contains("cm-editor")) {
        e = e.parentElement;
    }
    if (!e) {
        return null;
    }
    return view.EditorView.findFromDOM(e);
}
function isClickOnBullet(e) {
    let el = e.target;
    while (el) {
        if (el.classList.contains("cm-formatting-list") ||
            el.classList.contains("cm-fold-indicator")) {
            return true;
        }
        el = el.parentElement;
    }
    return false;
}
function isSameRoots(a, b) {
    const aRange = a.getRange();
    const bRange = b.getRange();
    if (cmpPos(aRange[0], bRange[0]) !== 0 ||
        cmpPos(aRange[1], bRange[1]) !== 0) {
        return false;
    }
    return a.print() === b.print();
}
function isFeatureSupported() {
    return obsidian.Platform.isDesktop;
}

class EnsureCursorInListContentOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const linePrefix = contentStart.line === cursor.line
            ? contentStart.ch
            : list.getNotesIndent().length;
        if (cursor.ch < linePrefix) {
            this.updated = true;
            root.replaceCursor({
                line: cursor.line,
                ch: linePrefix,
            });
        }
    }
}

class EnsureCursorIsInUnfoldedLineOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        if (!list.isFolded()) {
            return;
        }
        const foldRoot = list.getTopFoldRoot();
        const firstLineEnd = foldRoot.getLinesInfo()[0].to;
        if (cursor.line > firstLineEnd.line) {
            this.updated = true;
            root.replaceCursor(firstLineEnd);
        }
    }
}

class EnsureCursorInListContentFeature {
    constructor(plugin, settings, obsidian, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidian = obsidian;
        this.performOperation = performOperation;
        this.transactionExtender = (tr) => {
            if (this.settings.stickCursor == "never" || !tr.selection) {
                return null;
            }
            const editor = this.obsidian.getEditorFromState(tr.startState);
            setTimeout(() => {
                this.handleCursorActivity(editor);
            }, 0);
            return null;
        };
        this.handleCursorActivity = (editor) => {
            this.performOperation.performOperation((root) => new EnsureCursorIsInUnfoldedLineOperation(root), editor);
            this.performOperation.performOperation((root) => new EnsureCursorInListContentOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.EditorState.transactionExtender.of(this.transactionExtender));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class MoveLeftOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        if (!grandParent) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentRmFrom = parent.getFirstLineIndent().length;
        const indentRmTill = list.getFirstLineIndent().length;
        parent.removeChild(list);
        grandParent.addAfter(parent, list);
        list.unindentContent(indentRmFrom, indentRmTill);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const chDiff = indentRmTill - indentRmFrom;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch - chDiff,
        });
        recalculateNumericBullets(root);
    }
}

function isEmptyLineOrEmptyCheckbox(line) {
    return line === "" || line === "[ ] ";
}

class OutdentIfLineIsEmptyOperation {
    constructor(root) {
        this.root = root;
        this.moveLeftOp = new MoveLeftOperation(root);
    }
    shouldStopPropagation() {
        return this.moveLeftOp.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.moveLeftOp.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLines();
        if (lines.length > 1 ||
            !isEmptyLineOrEmptyCheckbox(lines[0]) ||
            list.getLevel() === 1) {
            return;
        }
        this.moveLeftOp.perform();
    }
}

class EnterOutdentIfLineIsEmptyFeature {
    constructor(plugin, settings, ime, obsidian, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.ime = ime;
        this.obsidian = obsidian;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.betterEnter && !this.ime.isIMEOpened();
        };
        this.run = (editor) => {
            return this.performOperation.performOperation((root) => new OutdentIfLineIsEmptyOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Enter",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const checkboxRe = `\\[[^\\[\\]]\\][ \t]`;

class CreateNewItemOperation {
    constructor(root, defaultIndentChars, getZoomRange) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.getZoomRange = getZoomRange;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelection();
        if (!selection || selection.anchor.line !== selection.head.line) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        if (lines.length === 1 && isEmptyLineOrEmptyCheckbox(lines[0].text)) {
            return;
        }
        const cursor = root.getCursor();
        const lineUnderCursor = lines.find((l) => l.from.line === cursor.line);
        if (cursor.ch < lineUnderCursor.from.ch) {
            return;
        }
        const { oldLines, newLines } = lines.reduce((acc, line) => {
            if (cursor.line > line.from.line) {
                acc.oldLines.push(line.text);
            }
            else if (cursor.line === line.from.line) {
                const left = line.text.slice(0, selection.from - line.from.ch);
                const right = line.text.slice(selection.to - line.from.ch);
                acc.oldLines.push(left);
                acc.newLines.push(right);
            }
            else if (cursor.line < line.from.line) {
                acc.newLines.push(line.text);
            }
            return acc;
        }, {
            oldLines: [],
            newLines: [],
        });
        const codeBlockBacticks = oldLines.join("\n").split("```").length - 1;
        const isInsideCodeblock = codeBlockBacticks > 0 && codeBlockBacticks % 2 !== 0;
        if (isInsideCodeblock) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const zoomRange = this.getZoomRange.getZoomRange();
        const listIsZoomingRoot = Boolean(zoomRange &&
            list.getFirstLineContentStart().line >= zoomRange.from.line &&
            list.getLastLineContentEnd().line <= zoomRange.from.line);
        const hasChildren = !list.isEmpty();
        const childIsFolded = list.isFoldRoot();
        const endPos = list.getLastLineContentEnd();
        const endOfLine = cursor.line === endPos.line && cursor.ch === endPos.ch;
        const onChildLevel = listIsZoomingRoot || (hasChildren && !childIsFolded && endOfLine);
        const indent = onChildLevel
            ? hasChildren
                ? list.getChildren()[0].getFirstLineIndent()
                : list.getFirstLineIndent() + this.defaultIndentChars
            : list.getFirstLineIndent();
        const bullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getBullet()
            : list.getBullet();
        const spaceAfterBullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getSpaceAfterBullet()
            : list.getSpaceAfterBullet();
        const prefix = oldLines[0].match(checkboxRe) ? "[ ] " : "";
        const newList = new List(list.getRoot(), indent, bullet, prefix, spaceAfterBullet, prefix + newLines.shift(), false);
        if (newLines.length > 0) {
            newList.setNotesIndent(list.getNotesIndent());
            for (const line of newLines) {
                newList.addLine(line);
            }
        }
        if (onChildLevel) {
            list.addBeforeAll(newList);
        }
        else {
            if (!childIsFolded || !endOfLine) {
                const children = list.getChildren();
                for (const child of children) {
                    list.removeChild(child);
                    newList.addAfterAll(child);
                }
            }
            list.getParent().addAfter(list, newList);
        }
        list.replaceLines(oldLines);
        const newListStart = newList.getFirstLineContentStart();
        root.replaceCursor({
            line: newListStart.line,
            ch: newListStart.ch + prefix.length,
        });
        recalculateNumericBullets(root);
    }
}

class EnterShouldCreateNewItemFeature {
    constructor(plugin, settings, ime, obsidian, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.ime = ime;
        this.obsidian = obsidian;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.betterEnter && !this.ime.isIMEOpened();
        };
        this.run = (editor) => {
            const zoomRange = editor.getZoomRange();
            const res = this.performOperation.performOperation((root) => new CreateNewItemOperation(root, this.obsidian.getDefaultIndentChars(), {
                getZoomRange: () => zoomRange,
            }), editor);
            if (res.shouldUpdate && zoomRange) {
                editor.zoomIn(zoomRange.from.line);
            }
            return res;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Enter",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class FoldFeature {
    constructor(plugin, obsidian) {
        this.plugin = plugin;
        this.obsidian = obsidian;
        this.fold = (editor) => {
            return this.setFold(editor, "fold");
        };
        this.unfold = (editor) => {
            return this.setFold(editor, "unfold");
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "fold",
                icon: "chevrons-down-up",
                name: "Fold the list",
                editorCallback: this.obsidian.createEditorCallback(this.fold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "unfold",
                icon: "chevrons-up-down",
                name: "Unfold the list",
                editorCallback: this.obsidian.createEditorCallback(this.unfold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowDown",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    setFold(editor, type) {
        if (!this.obsidian.getObsidianFoldSettings().foldIndent) {
            new obsidian.Notice(`Unable to ${type} because folding is disabled. Please enable "Fold indent" in Obsidian settings.`, 5000);
            return true;
        }
        const cursor = editor.getCursor();
        if (type === "fold") {
            editor.fold(cursor.line);
        }
        else {
            editor.unfold(cursor.line);
        }
        return true;
    }
}

class ListLinesViewPluginValue {
    constructor(settings, obsidian$1, parser, view) {
        this.settings = settings;
        this.obsidian = obsidian$1;
        this.parser = parser;
        this.view = view;
        this.lineElements = [];
        this.waitForEditor = () => {
            const oe = this.view.state.field(obsidian.editorInfoField).editor;
            if (!oe) {
                setTimeout(this.waitForEditor, 0);
                return;
            }
            this.editor = new MyEditor(oe);
            this.scheduleRecalculate();
        };
        this.onScroll = (e) => {
            const { scrollLeft, scrollTop } = e.target;
            this.scroller.scrollTo(scrollLeft, scrollTop);
        };
        this.scheduleRecalculate = () => {
            clearTimeout(this.scheduled);
            this.scheduled = setTimeout(this.calculate, 0);
        };
        this.calculate = () => {
            this.lines = [];
            if (this.settings.listLines &&
                this.obsidian.isDefaultThemeEnabled() &&
                this.view.viewportLineBlocks.length > 0 &&
                this.view.visibleRanges.length > 0) {
                const fromLine = this.editor.offsetToPos(this.view.viewport.from).line;
                const toLine = this.editor.offsetToPos(this.view.viewport.to).line;
                const lists = this.parser.parseRange(this.editor, fromLine, toLine);
                for (const list of lists) {
                    this.lastLine = list.getRange()[1].line;
                    for (const c of list.getChildren()) {
                        this.recursive(c);
                    }
                }
                this.lines.sort((a, b) => a.top === b.top ? a.left - b.left : a.top - b.top);
            }
            this.updateDom();
        };
        this.onClick = (e) => {
            e.preventDefault();
            const line = this.lines[Number(e.target.dataset.index)];
            switch (this.settings.listLineAction) {
                case "zoom-in":
                    this.zoomIn(line);
                    break;
                case "toggle-folding":
                    this.toggleFolding(line);
                    break;
            }
        };
        this.view.scrollDOM.addEventListener("scroll", this.onScroll);
        this.settings.onChange("listLines", this.scheduleRecalculate);
        this.prepareDom();
        this.waitForEditor();
    }
    prepareDom() {
        this.contentContainer = document.createElement("div");
        this.contentContainer.classList.add("outliner-plugin-list-lines-content-container");
        this.scroller = document.createElement("div");
        this.scroller.classList.add("outliner-plugin-list-lines-scroller");
        this.scroller.appendChild(this.contentContainer);
        this.view.dom.appendChild(this.scroller);
    }
    update(update) {
        if (update.docChanged ||
            update.viewportChanged ||
            update.geometryChanged ||
            update.transactions.some((tr) => tr.reconfigured)) {
            this.scheduleRecalculate();
        }
    }
    getNextSibling(list) {
        let listTmp = list;
        let p = listTmp.getParent();
        while (p) {
            const nextSibling = p.getNextSiblingOf(listTmp);
            if (nextSibling) {
                return nextSibling;
            }
            listTmp = p;
            p = listTmp.getParent();
        }
        return null;
    }
    recursive(list, parentCtx = {}) {
        const children = list.getChildren();
        if (children.length === 0) {
            return;
        }
        const fromOffset = this.editor.posToOffset({
            line: list.getFirstLineContentStart().line,
            ch: list.getFirstLineIndent().length,
        });
        const nextSibling = this.getNextSibling(list);
        const tillOffset = this.editor.posToOffset({
            line: nextSibling
                ? nextSibling.getFirstLineContentStart().line - 1
                : this.lastLine,
            ch: 0,
        });
        let visibleFrom = this.view.visibleRanges[0].from;
        let visibleTo = this.view.visibleRanges[this.view.visibleRanges.length - 1].to;
        const zoomRange = this.editor.getZoomRange();
        if (zoomRange) {
            visibleFrom = Math.max(visibleFrom, this.editor.posToOffset(zoomRange.from));
            visibleTo = Math.min(visibleTo, this.editor.posToOffset(zoomRange.to));
        }
        if (fromOffset > visibleTo || tillOffset < visibleFrom) {
            return;
        }
        const coords = this.view.coordsAtPos(fromOffset, 1);
        if (parentCtx.rootLeft === undefined) {
            parentCtx.rootLeft = coords.left;
        }
        const left = Math.floor(coords.right - parentCtx.rootLeft);
        const top = visibleFrom > 0 && fromOffset < visibleFrom
            ? -20
            : this.view.lineBlockAt(fromOffset).top;
        const bottom = tillOffset > visibleTo
            ? this.view.lineBlockAt(visibleTo - 1).bottom
            : this.view.lineBlockAt(tillOffset).bottom;
        const height = bottom - top;
        if (height > 0 && !list.isFolded()) {
            const nextSibling = list.getParent().getNextSiblingOf(list);
            const hasNextSibling = !!nextSibling &&
                this.editor.posToOffset(nextSibling.getFirstLineContentStart()) <=
                    visibleTo;
            this.lines.push({
                top,
                left,
                height: `calc(${height}px ${hasNextSibling ? "- 1.5em" : "- 2em"})`,
                list,
            });
        }
        for (const child of children) {
            if (!child.isEmpty()) {
                this.recursive(child, parentCtx);
            }
        }
    }
    zoomIn(line) {
        const editor = new MyEditor(this.view.state.field(obsidian.editorInfoField).editor);
        editor.zoomIn(line.list.getFirstLineContentStart().line);
    }
    toggleFolding(line) {
        const { list } = line;
        if (list.isEmpty()) {
            return;
        }
        let needToUnfold = true;
        const linesToToggle = [];
        for (const c of list.getChildren()) {
            if (c.isEmpty()) {
                continue;
            }
            if (!c.isFolded()) {
                needToUnfold = false;
            }
            linesToToggle.push(c.getFirstLineContentStart().line);
        }
        const editor = new MyEditor(this.view.state.field(obsidian.editorInfoField).editor);
        for (const l of linesToToggle) {
            if (needToUnfold) {
                editor.unfold(l);
            }
            else {
                editor.fold(l);
            }
        }
    }
    updateDom() {
        const cmScroll = this.view.scrollDOM;
        const cmContent = this.view.contentDOM;
        const cmContentContainer = cmContent.parentElement;
        const cmSizer = cmContentContainer.parentElement;
        /**
         * Obsidian can add additional elements into Content Manager.
         * The most obvious case is the 'embedded-backlinks' core plugin that adds a menu inside a Content Manager.
         * We must take heights of all of these elements into account
         * to be able to calculate the correct size of lines' container.
         */
        let cmSizerChildrenSumHeight = 0;
        for (let i = 0; i < cmSizer.children.length; i++) {
            cmSizerChildrenSumHeight += cmSizer.children[i].clientHeight;
        }
        this.scroller.style.top = cmScroll.offsetTop + "px";
        this.contentContainer.style.height = cmSizerChildrenSumHeight + "px";
        this.contentContainer.style.marginLeft =
            cmContentContainer.offsetLeft + "px";
        this.contentContainer.style.marginTop =
            cmContent.firstElementChild.offsetTop - 24 + "px";
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lineElements.length === i) {
                const e = document.createElement("div");
                e.classList.add("outliner-plugin-list-line");
                e.dataset.index = String(i);
                e.addEventListener("mousedown", this.onClick);
                this.contentContainer.appendChild(e);
                this.lineElements.push(e);
            }
            const l = this.lines[i];
            const e = this.lineElements[i];
            e.style.top = l.top + "px";
            e.style.left = l.left + "px";
            e.style.height = l.height;
            e.style.display = "block";
        }
        for (let i = this.lines.length; i < this.lineElements.length; i++) {
            const e = this.lineElements[i];
            e.style.top = "0px";
            e.style.left = "0px";
            e.style.height = "0px";
            e.style.display = "none";
        }
    }
    destroy() {
        this.settings.removeCallback("listLines", this.scheduleRecalculate);
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.view.dom.removeChild(this.scroller);
        clearTimeout(this.scheduled);
    }
}
class LinesFeature {
    constructor(plugin, settings, obsidian, parser) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidian = obsidian;
        this.parser = parser;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.ViewPlugin.define((view) => new ListLinesViewPluginValue(this.settings, this.obsidian, this.parser, view)));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const BETTER_LISTS_CLASS = "outliner-plugin-better-lists";
const BETTER_BULLETS_CLASS = "outliner-plugin-better-bullets";
const VERTICAL_LINES = "outliner-plugin-vertical-lines";
const KNOWN_CLASSES = [
    BETTER_LISTS_CLASS,
    BETTER_BULLETS_CLASS,
    VERTICAL_LINES,
];
class ListsStylesFeature {
    constructor(settings, obsidian) {
        this.settings = settings;
        this.obsidian = obsidian;
        this.syncListsStyles = () => {
            const classes = [];
            if (this.obsidian.isDefaultThemeEnabled()) {
                if (this.settings.styleLists) {
                    classes.push(BETTER_LISTS_CLASS);
                    classes.push(BETTER_BULLETS_CLASS);
                }
                if (this.settings.listLines) {
                    classes.push(VERTICAL_LINES);
                }
            }
            this.applyListsStyles(classes);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.syncListsStyles();
            this.interval = window.setInterval(() => {
                this.syncListsStyles();
            }, 1000);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.interval);
            this.applyListsStyles([]);
        });
    }
    applyListsStyles(classes) {
        const toKeep = classes.filter((c) => KNOWN_CLASSES.contains(c));
        const toRemove = KNOWN_CLASSES.filter((c) => !toKeep.contains(c));
        for (const c of toKeep) {
            if (!document.body.classList.contains(c)) {
                document.body.classList.add(c);
            }
        }
        for (const c of toRemove) {
            if (document.body.classList.contains(c)) {
                document.body.classList.remove(c);
            }
        }
    }
}

class MoveCursorToPreviousUnfoldedLineOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = this.root.getListUnderCursor();
        const cursor = this.root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => {
            return (cursor.ch === l.from.ch + list.getCheckboxLength() &&
                cursor.line === l.from.line);
        });
        if (lineNo === 0) {
            this.moveCursorToPreviousUnfoldedItem(root, cursor);
        }
        else if (lineNo > 0) {
            this.moveCursorToPreviousNoteLine(root, lines, lineNo);
        }
    }
    moveCursorToPreviousNoteLine(root, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        root.replaceCursor(lines[lineNo - 1].to);
    }
    moveCursorToPreviousUnfoldedItem(root, cursor) {
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        if (prev.isFolded()) {
            const foldRoot = prev.getTopFoldRoot();
            const firstLineEnd = foldRoot.getLinesInfo()[0].to;
            root.replaceCursor(firstLineEnd);
        }
        else {
            root.replaceCursor(prev.getLastLineContentEnd());
        }
    }
}

class MoveCursorToPreviousUnfoldedLineFeature {
    constructor(plugin, settings, ime, obsidian, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.ime = ime;
        this.obsidian = obsidian;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.stickCursor != "never" && !this.ime.isIMEOpened();
        };
        this.run = (editor) => {
            return this.performOperation.performOperation((root) => new MoveCursorToPreviousUnfoldedLineOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "ArrowLeft",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
                {
                    win: "c-ArrowLeft",
                    linux: "c-ArrowLeft",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class MoveDownOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const next = parent.getNextSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        if (!next && grandParent) {
            const newParent = grandParent.getNextSiblingOf(parent);
            if (newParent) {
                this.updated = true;
                parent.removeChild(list);
                newParent.addBeforeAll(list);
            }
        }
        else if (next) {
            this.updated = true;
            parent.removeChild(list);
            parent.addAfter(next, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch,
        });
        recalculateNumericBullets(root);
    }
}

class MoveRightOperation {
    constructor(root, defaultIndentChars) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const prev = parent.getPrevSiblingOf(list);
        if (!prev) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentPos = list.getFirstLineIndent().length;
        let indentChars = "";
        if (indentChars === "" && !prev.isEmpty()) {
            indentChars = prev
                .getChildren()[0]
                .getFirstLineIndent()
                .slice(prev.getFirstLineIndent().length);
        }
        if (indentChars === "") {
            indentChars = list
                .getFirstLineIndent()
                .slice(parent.getFirstLineIndent().length);
        }
        if (indentChars === "" && !list.isEmpty()) {
            indentChars = list.getChildren()[0].getFirstLineIndent();
        }
        if (indentChars === "") {
            indentChars = this.defaultIndentChars;
        }
        parent.removeChild(list);
        prev.addAfterAll(list);
        list.indentContent(indentPos, indentChars);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch + indentChars.length,
        });
        recalculateNumericBullets(root);
    }
}

class MoveUpOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const prev = parent.getPrevSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        if (!prev && grandParent) {
            const newParent = grandParent.getPrevSiblingOf(parent);
            if (newParent) {
                this.updated = true;
                parent.removeChild(list);
                newParent.addAfterAll(list);
            }
        }
        else if (prev) {
            this.updated = true;
            parent.removeChild(list);
            parent.addBefore(prev, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch,
        });
        recalculateNumericBullets(root);
    }
}

class MoveItemsFeature {
    constructor(plugin, ime, obsidian, settings, performOperation) {
        this.plugin = plugin;
        this.ime = ime;
        this.obsidian = obsidian;
        this.settings = settings;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.betterTab && !this.ime.isIMEOpened();
        };
        this.moveListElementDownCommand = (editor) => {
            const { shouldStopPropagation } = this.performOperation.performOperation((root) => new MoveDownOperation(root), editor);
            return shouldStopPropagation;
        };
        this.moveListElementUpCommand = (editor) => {
            const { shouldStopPropagation } = this.performOperation.performOperation((root) => new MoveUpOperation(root), editor);
            return shouldStopPropagation;
        };
        this.moveListElementRightCommand = (editor) => {
            if (this.ime.isIMEOpened()) {
                return true;
            }
            return this.moveListElementRight(editor).shouldStopPropagation;
        };
        this.moveListElementRight = (editor) => {
            return this.performOperation.performOperation((root) => new MoveRightOperation(root, this.obsidian.getDefaultIndentChars()), editor);
        };
        this.moveListElementLeftCommand = (editor) => {
            if (this.ime.isIMEOpened()) {
                return true;
            }
            return this.moveListElementLeft(editor).shouldStopPropagation;
        };
        this.moveListElementLeft = (editor) => {
            return this.performOperation.performOperation((root) => new MoveLeftOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "move-list-item-up",
                icon: "arrow-up",
                name: "Move list and sublists up",
                editorCallback: this.obsidian.createEditorCallback(this.moveListElementUpCommand),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "move-list-item-down",
                icon: "arrow-down",
                name: "Move list and sublists down",
                editorCallback: this.obsidian.createEditorCallback(this.moveListElementDownCommand),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowDown",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "indent-list",
                icon: "indent",
                name: "Indent the list and sublists",
                editorCallback: this.obsidian.createEditorCallback(this.moveListElementRightCommand),
                hotkeys: [],
            });
            this.plugin.addCommand({
                id: "outdent-list",
                icon: "outdent",
                name: "Outdent the list and sublists",
                editorCallback: this.obsidian.createEditorCallback(this.moveListElementLeftCommand),
                hotkeys: [],
            });
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Tab",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.moveListElementRight,
                    }),
                },
                {
                    key: "s-Tab",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.moveListElementLeft,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class SelectAllOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelections()[0];
        const [rootStart, rootEnd] = root.getRange();
        const selectionFrom = minPos(selection.anchor, selection.head);
        const selectionTo = maxPos(selection.anchor, selection.head);
        if (selectionFrom.line < rootStart.line ||
            selectionTo.line > rootEnd.line) {
            return false;
        }
        if (selectionFrom.line === rootStart.line &&
            selectionFrom.ch === rootStart.ch &&
            selectionTo.line === rootEnd.line &&
            selectionTo.ch === rootEnd.ch) {
            return false;
        }
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const contentEnd = list.getLastLineContentEnd();
        if (selectionFrom.line < contentStart.line ||
            selectionTo.line > contentEnd.line) {
            return false;
        }
        this.stopPropagation = true;
        this.updated = true;
        if (selectionFrom.line === contentStart.line &&
            selectionFrom.ch === contentStart.ch &&
            selectionTo.line === contentEnd.line &&
            selectionTo.ch === contentEnd.ch) {
            // select whole list
            root.replaceSelections([{ anchor: rootStart, head: rootEnd }]);
        }
        else {
            // select whole line
            root.replaceSelections([{ anchor: contentStart, head: contentEnd }]);
        }
        return true;
    }
}

class SelectAllFeature {
    constructor(plugin, settings, ime, obsidian, performOperation) {
        this.plugin = plugin;
        this.settings = settings;
        this.ime = ime;
        this.obsidian = obsidian;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.selectAll && !this.ime.isIMEOpened();
        };
        this.run = (editor) => {
            return this.performOperation.performOperation((root) => new SelectAllOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "c-a",
                    mac: "m-a",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ObsidianOutlinerPluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin, settings) {
        super(app, plugin);
        this.settings = settings;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Improve the style of your lists")
            .setDesc("Styles are only compatible with built-in Obsidian themes and may not be compatible with other themes.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.styleLists).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.styleLists = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Draw vertical indentation lines")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.listLines).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.listLines = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Vertical indentation line click action")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                none: "None",
                "zoom-in": "Zoom In",
                "toggle-folding": "Toggle Folding",
            })
                .setValue(this.settings.listLineAction)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.listLineAction = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Stick the cursor to the content")
            .setDesc("Don't let the cursor move to the bullet position.")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                never: "Never",
                "bullet-only": "Stick cursor out of bullets",
                "bullet-and-checkbox": "Stick cursor out of bullets and checkboxes",
            })
                .setValue(this.settings.stickCursor)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.stickCursor = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Enter key")
            .setDesc("Make the Enter key behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.betterEnter).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.betterEnter = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Tab key")
            .setDesc("Make Tab and Shift-Tab behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.betterTab).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.betterTab = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Ctrl+A or Cmd+A behavior")
            .setDesc("Press the hotkey once to select the current list item. Press the hotkey twice to select the entire list.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.selectAll).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.selectAll = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Drag-and-Drop (Experimental)")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.dndExperiment).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.dndExperiment = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Open DevTools (Command+Option+I or Control+Shift+I) to copy the debug logs.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.debug).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.debug = value;
                yield this.settings.save();
            }));
        });
    }
}
class SettingsTabFeature {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addSettingTab(new ObsidianOutlinerPluginSettingTab(this.plugin.app, this.plugin, this.settings));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class CreateNoteLineOperation {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const lineUnderCursor = list
            .getLinesInfo()
            .find((l) => l.from.line === cursor.line);
        if (cursor.ch < lineUnderCursor.from.ch) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        if (!list.getNotesIndent()) {
            list.setNotesIndent(list.getFirstLineIndent() + "  ");
        }
        const lines = list.getLinesInfo().reduce((acc, line) => {
            if (cursor.line === line.from.line) {
                acc.push(line.text.slice(0, cursor.ch - line.from.ch));
                acc.push(line.text.slice(cursor.ch - line.from.ch));
            }
            else {
                acc.push(line.text);
            }
            return acc;
        }, []);
        list.replaceLines(lines);
        root.replaceCursor({
            line: cursor.line + 1,
            ch: list.getNotesIndent().length,
        });
    }
}

class ShiftEnterShouldCreateNoteFeature {
    constructor(plugin, obsidian, settings, ime, performOperation) {
        this.plugin = plugin;
        this.obsidian = obsidian;
        this.settings = settings;
        this.ime = ime;
        this.performOperation = performOperation;
        this.check = () => {
            return this.settings.betterEnter && !this.ime.isIMEOpened();
        };
        this.run = (editor) => {
            return this.performOperation.performOperation((root) => new CreateNoteLineOperation(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "s-Enter",
                    run: this.obsidian.createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ApplyChangesService {
    applyChanges(editor, prevRoot, newRoot) {
        const changes = this.calculateChanges(editor, prevRoot, newRoot);
        if (changes) {
            const { replacement, changeFrom, changeTo } = changes;
            const { unfold, fold } = this.calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo);
            for (const line of unfold) {
                editor.unfold(line);
            }
            editor.replaceRange(replacement, changeFrom, changeTo);
            for (const line of fold) {
                editor.fold(line);
            }
        }
        editor.setSelections(newRoot.getSelections());
    }
    calculateChanges(editor, prevRoot, newRoot) {
        const rootRange = prevRoot.getRange();
        const oldString = editor.getRange(rootRange[0], rootRange[1]);
        const newString = newRoot.print();
        const changeFrom = Object.assign({}, rootRange[0]);
        const changeTo = Object.assign({}, rootRange[1]);
        let oldTmp = oldString;
        let newTmp = newString;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const nlIndex = oldTmp.lastIndexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(nlIndex);
            const newLine = newTmp.slice(-oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            oldTmp = oldTmp.slice(0, -oldLine.length);
            newTmp = newTmp.slice(0, -oldLine.length);
            const nlIndex2 = oldTmp.lastIndexOf("\n");
            changeTo.ch =
                nlIndex2 >= 0 ? oldTmp.length - nlIndex2 - 1 : oldTmp.length;
            changeTo.line--;
        }
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const nlIndex = oldTmp.indexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(0, nlIndex + 1);
            const newLine = newTmp.slice(0, oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            changeFrom.line++;
            oldTmp = oldTmp.slice(oldLine.length);
            newTmp = newTmp.slice(oldLine.length);
        }
        if (oldTmp === newTmp) {
            return null;
        }
        return {
            replacement: newTmp,
            changeFrom,
            changeTo,
        };
    }
    calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo) {
        const changedRange = [changeFrom, changeTo];
        const prevLists = getAllChildren(prevRoot);
        const newLists = getAllChildren(newRoot);
        const unfold = [];
        const fold = [];
        for (const prevList of prevLists.values()) {
            if (!prevList.isFoldRoot()) {
                continue;
            }
            const newList = newLists.get(prevList.getID());
            if (!newList) {
                continue;
            }
            const prevListRange = [
                prevList.getFirstLineContentStart(),
                prevList.getContentEndIncludingChildren(),
            ];
            if (isRangesIntersects(prevListRange, changedRange)) {
                unfold.push(prevList.getFirstLineContentStart().line);
                fold.push(newList.getFirstLineContentStart().line);
            }
        }
        unfold.sort((a, b) => b - a);
        fold.sort((a, b) => b - a);
        return { unfold, fold };
    }
}
function getAllChildrenReduceFn(acc, child) {
    acc.set(child.getID(), child);
    child.getChildren().reduce(getAllChildrenReduceFn, acc);
    return acc;
}
function getAllChildren(root) {
    return root.getChildren().reduce(getAllChildrenReduceFn, new Map());
}

class IMEService {
    constructor() {
        this.composition = false;
        this.onCompositionStart = () => {
            this.composition = true;
        };
        this.onCompositionEnd = () => {
            this.composition = false;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            document.addEventListener("compositionstart", this.onCompositionStart);
            document.addEventListener("compositionend", this.onCompositionEnd);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            document.removeEventListener("compositionend", this.onCompositionEnd);
            document.removeEventListener("compositionstart", this.onCompositionStart);
        });
    }
    isIMEOpened() {
        return this.composition && obsidian.Platform.isDesktop;
    }
}

class LoggerService {
    constructor(settings) {
        this.settings = settings;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(method, ...args) {
        if (!this.settings.debug) {
            return;
        }
        console.info(method, ...args);
    }
    bind(method) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args) => this.log(method, ...args);
    }
}

class ObsidianService {
    constructor(app) {
        this.app = app;
    }
    isLegacyEditorEnabled() {
        const config = Object.assign({ legacyEditor: false }, this.app.vault.config);
        return config.legacyEditor;
    }
    isDefaultThemeEnabled() {
        const config = Object.assign({ cssTheme: "" }, this.app.vault.config);
        return config.cssTheme === "";
    }
    getObsidianTabsSettings() {
        return Object.assign({ useTab: true, tabSize: 4 }, this.app.vault.config);
    }
    getObsidianFoldSettings() {
        return Object.assign({ foldIndent: true }, this.app.vault.config);
    }
    getDefaultIndentChars() {
        const { useTab, tabSize } = this.getObsidianTabsSettings();
        return useTab ? "\t" : new Array(tabSize).fill(" ").join("");
    }
    getEditorFromState(state) {
        return new MyEditor(state.field(obsidian.editorInfoField).editor);
    }
    createKeymapRunCallback(config) {
        const check = config.check || (() => true);
        const { run } = config;
        return (view) => {
            const editor = this.getEditorFromState(view.state);
            if (!check(editor)) {
                return false;
            }
            const { shouldUpdate, shouldStopPropagation } = run(editor);
            return shouldUpdate || shouldStopPropagation;
        };
    }
    createEditorCallback(cb) {
        return (editor) => {
            const myEditor = new MyEditor(editor);
            const shouldStopPropagation = cb(myEditor);
            if (!shouldStopPropagation &&
                window.event &&
                window.event.type === "keydown") {
                myEditor.triggerOnKeyDown(window.event);
            }
        };
    }
}

const bulletSignRe = `(?:[-*+]|\\d+\\.)`;
const optionalCheckboxRe = `(?:${checkboxRe})?`;
const listItemWithoutSpacesRe = new RegExp(`^${bulletSignRe}( |\t)`);
const listItemRe = new RegExp(`^[ \t]*${bulletSignRe}( |\t)`);
const stringWithSpacesRe = new RegExp(`^[ \t]+`);
const parseListItemRe = new RegExp(`^([ \t]*)(${bulletSignRe})( |\t)(${optionalCheckboxRe})(.*)$`);
class ParserService {
    constructor(logger, settings) {
        this.logger = logger;
        this.settings = settings;
    }
    parseRange(editor, fromLine = 0, toLine = editor.lastLine()) {
        const lists = [];
        for (let i = fromLine; i <= toLine; i++) {
            const line = editor.getLine(i);
            if (i === fromLine || this.isListItem(line)) {
                const list = this.parseWithLimits(editor, i, fromLine, toLine);
                if (list) {
                    lists.push(list);
                    i = list.getRange()[1].line;
                }
            }
        }
        return lists;
    }
    parse(editor, cursor = editor.getCursor()) {
        return this.parseWithLimits(editor, cursor.line, 0, editor.lastLine());
    }
    parseWithLimits(editor, parsingStartLine, limitFrom, limitTo) {
        const d = this.logger.bind("parseList");
        const error = (msg) => {
            d(msg);
            return null;
        };
        const line = editor.getLine(parsingStartLine);
        let listLookingPos = null;
        if (this.isListItem(line)) {
            listLookingPos = parsingStartLine;
        }
        else if (this.isLineWithIndent(line)) {
            let listLookingPosSearch = parsingStartLine - 1;
            while (listLookingPosSearch >= 0) {
                const line = editor.getLine(listLookingPosSearch);
                if (this.isListItem(line)) {
                    listLookingPos = listLookingPosSearch;
                    break;
                }
                else if (this.isLineWithIndent(line)) {
                    listLookingPosSearch--;
                }
                else {
                    break;
                }
            }
        }
        if (listLookingPos == null) {
            return null;
        }
        let listStartLine = null;
        let listStartLineLookup = listLookingPos;
        while (listStartLineLookup >= 0) {
            const line = editor.getLine(listStartLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (this.isListItemWithoutSpaces(line)) {
                listStartLine = listStartLineLookup;
                if (listStartLineLookup <= limitFrom) {
                    break;
                }
            }
            listStartLineLookup--;
        }
        if (listStartLine === null) {
            return null;
        }
        let listEndLine = listLookingPos;
        let listEndLineLookup = listLookingPos;
        while (listEndLineLookup <= editor.lastLine()) {
            const line = editor.getLine(listEndLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (!this.isEmptyLine(line)) {
                listEndLine = listEndLineLookup;
            }
            if (listEndLineLookup >= limitTo) {
                listEndLine = limitTo;
                break;
            }
            listEndLineLookup++;
        }
        if (listStartLine > parsingStartLine || listEndLine < parsingStartLine) {
            return null;
        }
        const root = new Root({ line: listStartLine, ch: 0 }, { line: listEndLine, ch: editor.getLine(listEndLine).length }, editor.listSelections().map((r) => ({
            anchor: { line: r.anchor.line, ch: r.anchor.ch },
            head: { line: r.head.line, ch: r.head.ch },
        })));
        let currentParent = root.getRootList();
        let currentList = null;
        let currentIndent = "";
        const foldedLines = editor.getAllFoldedLines();
        for (let l = listStartLine; l <= listEndLine; l++) {
            const line = editor.getLine(l);
            const matches = parseListItemRe.exec(line);
            if (matches) {
                const [, indent, bullet, spaceAfterBullet] = matches;
                let [, , , , optionalCheckbox, content] = matches;
                content = optionalCheckbox + content;
                if (this.settings.stickCursor != "bullet-and-checkbox") {
                    optionalCheckbox = "";
                }
                const compareLength = Math.min(currentIndent.length, indent.length);
                const indentSlice = indent.slice(0, compareLength);
                const currentIndentSlice = currentIndent.slice(0, compareLength);
                if (indentSlice !== currentIndentSlice) {
                    const expected = currentIndentSlice
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    const got = indentSlice.replace(/ /g, "S").replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (indent.length > currentIndent.length) {
                    currentParent = currentList;
                    currentIndent = indent;
                }
                else if (indent.length < currentIndent.length) {
                    while (currentParent.getFirstLineIndent().length >= indent.length &&
                        currentParent.getParent()) {
                        currentParent = currentParent.getParent();
                    }
                    currentIndent = indent;
                }
                const foldRoot = foldedLines.includes(l);
                currentList = new List(root, indent, bullet, optionalCheckbox, spaceAfterBullet, content, foldRoot);
                currentParent.addAfterAll(currentList);
            }
            else if (this.isLineWithIndent(line)) {
                if (!currentList) {
                    return error(`Unable to parse list: expected list item, got empty line`);
                }
                const indentToCheck = currentList.getNotesIndent() || currentIndent;
                if (line.indexOf(indentToCheck) !== 0) {
                    const expected = indentToCheck.replace(/ /g, "S").replace(/\t/g, "T");
                    const got = line
                        .match(/^[ \t]*/)[0]
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (!currentList.getNotesIndent()) {
                    const matches = line.match(/^[ \t]+/);
                    if (!matches || matches[0].length <= currentIndent.length) {
                        if (/^\s+$/.test(line)) {
                            continue;
                        }
                        return error(`Unable to parse list: expected some indent, got no indent`);
                    }
                    currentList.setNotesIndent(matches[0]);
                }
                currentList.addLine(line.slice(currentList.getNotesIndent().length));
            }
            else {
                return error(`Unable to parse list: expected list item or note, got "${line}"`);
            }
        }
        return root;
    }
    isEmptyLine(line) {
        return line.length === 0;
    }
    isLineWithIndent(line) {
        return stringWithSpacesRe.test(line);
    }
    isListItem(line) {
        return listItemRe.test(line);
    }
    isListItemWithoutSpaces(line) {
        return listItemWithoutSpacesRe.test(line);
    }
}

class PerformOperationService {
    constructor(parser, applyChanges) {
        this.parser = parser;
        this.applyChanges = applyChanges;
    }
    evalOperation(root, op, editor) {
        const prevRoot = root.clone();
        op.perform();
        if (op.shouldUpdate()) {
            this.applyChanges.applyChanges(editor, prevRoot, root);
        }
        return {
            shouldUpdate: op.shouldUpdate(),
            shouldStopPropagation: op.shouldStopPropagation(),
        };
    }
    performOperation(cb, editor, cursor = editor.getCursor()) {
        const root = this.parser.parse(editor, cursor);
        if (!root) {
            return { shouldUpdate: false, shouldStopPropagation: false };
        }
        const op = cb(root);
        return this.evalOperation(root, op, editor);
    }
}

const DEFAULT_SETTINGS = {
    styleLists: true,
    debug: false,
    stickCursor: "bullet-and-checkbox",
    betterEnter: true,
    betterTab: true,
    selectAll: true,
    listLines: false,
    listLineAction: "toggle-folding",
    dndExperiment: false,
    previousRelease: null,
};
class SettingsService {
    constructor(storage) {
        this.storage = storage;
        this.handlers = new Map();
    }
    get styleLists() {
        return this.values.styleLists;
    }
    set styleLists(value) {
        this.set("styleLists", value);
    }
    get debug() {
        return this.values.debug;
    }
    set debug(value) {
        this.set("debug", value);
    }
    get stickCursor() {
        // Adaptor for users migrating from older version of the plugin.
        if (this.values.stickCursor === true) {
            return "bullet-and-checkbox";
        }
        else if (this.values.stickCursor === false) {
            return "never";
        }
        return this.values.stickCursor;
    }
    set stickCursor(value) {
        this.set("stickCursor", value);
    }
    get betterEnter() {
        return this.values.betterEnter;
    }
    set betterEnter(value) {
        this.set("betterEnter", value);
    }
    get dndExperiment() {
        return this.values.dndExperiment;
    }
    set dndExperiment(value) {
        this.set("dndExperiment", value);
    }
    get betterTab() {
        return this.values.betterTab;
    }
    set betterTab(value) {
        this.set("betterTab", value);
    }
    get selectAll() {
        return this.values.selectAll;
    }
    set selectAll(value) {
        this.set("selectAll", value);
    }
    get listLines() {
        return this.values.listLines;
    }
    set listLines(value) {
        this.set("listLines", value);
    }
    get listLineAction() {
        return this.values.listLineAction;
    }
    set listLineAction(value) {
        this.set("listLineAction", value);
    }
    get previousRelease() {
        return this.values.previousRelease;
    }
    set previousRelease(value) {
        this.set("previousRelease", value);
    }
    onChange(key, cb) {
        if (!this.handlers.has(key)) {
            this.handlers.set(key, new Set());
        }
        this.handlers.get(key).add(cb);
    }
    removeCallback(key, cb) {
        const handlers = this.handlers.get(key);
        if (handlers) {
            handlers.delete(cb);
        }
    }
    reset() {
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
            this.set(k, v);
        }
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.values = Object.assign({}, DEFAULT_SETTINGS, yield this.storage.loadData());
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.storage.saveData(this.values);
        });
    }
    set(key, value) {
        this.values[key] = value;
        const callbacks = this.handlers.get(key);
        if (!callbacks) {
            return;
        }
        for (const cb of callbacks.values()) {
            cb(value);
        }
    }
}

class ObsidianOutlinerPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Loading obsidian-outliner`);
            this.obsidian = new ObsidianService(this.app);
            this.settings = new SettingsService(this);
            yield this.settings.load();
            this.logger = new LoggerService(this.settings);
            this.parser = new ParserService(this.logger, this.settings);
            this.applyChanges = new ApplyChangesService();
            this.performOperation = new PerformOperationService(this.parser, this.applyChanges);
            this.ime = new IMEService();
            yield this.ime.load();
            this.features = [
                new ChangelogModalFeature(this, this.settings),
                new DragAndDropFeature(this, this.settings, this.obsidian, this.parser, this.performOperation),
                new SettingsTabFeature(this, this.settings),
                new ListsStylesFeature(this.settings, this.obsidian),
                new EnterOutdentIfLineIsEmptyFeature(this, this.settings, this.ime, this.obsidian, this.performOperation),
                new EnterShouldCreateNewItemFeature(this, this.settings, this.ime, this.obsidian, this.performOperation),
                new EnsureCursorInListContentFeature(this, this.settings, this.obsidian, this.performOperation),
                new MoveCursorToPreviousUnfoldedLineFeature(this, this.settings, this.ime, this.obsidian, this.performOperation),
                new DeleteShouldIgnoreBulletsFeature(this, this.settings, this.ime, this.obsidian, this.performOperation),
                new FoldFeature(this, this.obsidian),
                new SelectAllFeature(this, this.settings, this.ime, this.obsidian, this.performOperation),
                new MoveItemsFeature(this, this.ime, this.obsidian, this.settings, this.performOperation),
                new ShiftEnterShouldCreateNoteFeature(this, this.obsidian, this.settings, this.ime, this.performOperation),
                new LinesFeature(this, this.settings, this.obsidian, this.parser),
            ];
            for (const feature of this.features) {
                yield feature.load();
            }
        });
    }
    onunload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Unloading obsidian-outliner`);
            yield this.ime.unload();
            for (const feature of this.features) {
                yield feature.unload();
            }
        });
    }
}

module.exports = ObsidianOutlinerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9mZWF0dXJlcy9DaGFuZ2Vsb2dNb2RhbEZlYXR1cmUudHMiLCJzcmMvcm9vdC9yZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzLnRzIiwic3JjL29wZXJhdGlvbnMvRGVsZXRlQW5kTWVyZ2VXaXRoUHJldmlvdXNMaW5lT3BlcmF0aW9uLnRzIiwic3JjL29wZXJhdGlvbnMvRGVsZXRlQW5kTWVyZ2VXaXRoTmV4dExpbmVPcGVyYXRpb24udHMiLCJzcmMvb3BlcmF0aW9ucy9EZWxldGVUaWxsTGluZVN0YXJ0T3BlcmF0aW9uLnRzIiwic3JjL2ZlYXR1cmVzL0RlbGV0ZVNob3VsZElnbm9yZUJ1bGxldHNGZWF0dXJlLnRzIiwic3JjL015RWRpdG9yLnRzIiwic3JjL29wZXJhdGlvbnMvTW92ZUxpc3RUb0RpZmZlcmVudFBvc2l0aW9uT3BlcmF0aW9uLnRzIiwic3JjL3Jvb3QvaW5kZXgudHMiLCJzcmMvZmVhdHVyZXMvRHJhZ0FuZERyb3BGZWF0dXJlLnRzIiwic3JjL29wZXJhdGlvbnMvRW5zdXJlQ3Vyc29ySW5MaXN0Q29udGVudE9wZXJhdGlvbi50cyIsInNyYy9vcGVyYXRpb25zL0Vuc3VyZUN1cnNvcklzSW5VbmZvbGRlZExpbmVPcGVyYXRpb24udHMiLCJzcmMvZmVhdHVyZXMvRW5zdXJlQ3Vyc29ySW5MaXN0Q29udGVudEZlYXR1cmUudHMiLCJzcmMvb3BlcmF0aW9ucy9Nb3ZlTGVmdE9wZXJhdGlvbi50cyIsInNyYy91dGlscy9pc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveC50cyIsInNyYy9vcGVyYXRpb25zL091dGRlbnRJZkxpbmVJc0VtcHR5T3BlcmF0aW9uLnRzIiwic3JjL2ZlYXR1cmVzL0VudGVyT3V0ZGVudElmTGluZUlzRW1wdHlGZWF0dXJlLnRzIiwic3JjL3V0aWxzL2NoZWNrYm94UmUudHMiLCJzcmMvb3BlcmF0aW9ucy9DcmVhdGVOZXdJdGVtT3BlcmF0aW9uLnRzIiwic3JjL2ZlYXR1cmVzL0VudGVyU2hvdWxkQ3JlYXRlTmV3SXRlbU9uQ2hpbGRMZXZlbEZlYXR1cmUudHMiLCJzcmMvZmVhdHVyZXMvRm9sZEZlYXR1cmUudHMiLCJzcmMvZmVhdHVyZXMvTGluZXNGZWF0dXJlLnRzIiwic3JjL2ZlYXR1cmVzL0xpc3RzU3R5bGVzRmVhdHVyZS50cyIsInNyYy9vcGVyYXRpb25zL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lT3BlcmF0aW9uLnRzIiwic3JjL2ZlYXR1cmVzL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lRmVhdHVyZS50cyIsInNyYy9vcGVyYXRpb25zL01vdmVEb3duT3BlcmF0aW9uLnRzIiwic3JjL29wZXJhdGlvbnMvTW92ZVJpZ2h0T3BlcmF0aW9uLnRzIiwic3JjL29wZXJhdGlvbnMvTW92ZVVwT3BlcmF0aW9uLnRzIiwic3JjL2ZlYXR1cmVzL01vdmVJdGVtc0ZlYXR1cmUudHMiLCJzcmMvb3BlcmF0aW9ucy9TZWxlY3RBbGxPcGVyYXRpb24udHMiLCJzcmMvZmVhdHVyZXMvU2VsZWN0QWxsRmVhdHVyZS50cyIsInNyYy9mZWF0dXJlcy9TZXR0aW5nc1RhYkZlYXR1cmUudHMiLCJzcmMvb3BlcmF0aW9ucy9DcmVhdGVOb3RlTGluZU9wZXJhdGlvbi50cyIsInNyYy9mZWF0dXJlcy9TaGlmdEVudGVyU2hvdWxkQ3JlYXRlTm90ZUZlYXR1cmUudHMiLCJzcmMvc2VydmljZXMvQXBwbHlDaGFuZ2VzU2VydmljZS50cyIsInNyYy9zZXJ2aWNlcy9JTUVTZXJ2aWNlLnRzIiwic3JjL3NlcnZpY2VzL0xvZ2dlclNlcnZpY2UudHMiLCJzcmMvc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlLnRzIiwic3JjL3NlcnZpY2VzL1BhcnNlclNlcnZpY2UudHMiLCJzcmMvc2VydmljZXMvUGVyZm9ybU9wZXJhdGlvblNlcnZpY2UudHMiLCJzcmMvc2VydmljZXMvU2V0dGluZ3NTZXJ2aWNlLnRzIiwic3JjL09ic2lkaWFuT3V0bGluZXJQbHVnaW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2VzRGVjb3JhdGUoY3RvciwgZGVzY3JpcHRvckluLCBkZWNvcmF0b3JzLCBjb250ZXh0SW4sIGluaXRpYWxpemVycywgZXh0cmFJbml0aWFsaXplcnMpIHtcclxuICAgIGZ1bmN0aW9uIGFjY2VwdChmKSB7IGlmIChmICE9PSB2b2lkIDAgJiYgdHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZ1bmN0aW9uIGV4cGVjdGVkXCIpOyByZXR1cm4gZjsgfVxyXG4gICAgdmFyIGtpbmQgPSBjb250ZXh0SW4ua2luZCwga2V5ID0ga2luZCA9PT0gXCJnZXR0ZXJcIiA/IFwiZ2V0XCIgOiBraW5kID09PSBcInNldHRlclwiID8gXCJzZXRcIiA6IFwidmFsdWVcIjtcclxuICAgIHZhciB0YXJnZXQgPSAhZGVzY3JpcHRvckluICYmIGN0b3IgPyBjb250ZXh0SW5bXCJzdGF0aWNcIl0gPyBjdG9yIDogY3Rvci5wcm90b3R5cGUgOiBudWxsO1xyXG4gICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9ySW4gfHwgKHRhcmdldCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSkgOiB7fSk7XHJcbiAgICB2YXIgXywgZG9uZSA9IGZhbHNlO1xyXG4gICAgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICB2YXIgY29udGV4dCA9IHt9O1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluKSBjb250ZXh0W3BdID0gcCA9PT0gXCJhY2Nlc3NcIiA/IHt9IDogY29udGV4dEluW3BdO1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluLmFjY2VzcykgY29udGV4dC5hY2Nlc3NbcF0gPSBjb250ZXh0SW4uYWNjZXNzW3BdO1xyXG4gICAgICAgIGNvbnRleHQuYWRkSW5pdGlhbGl6ZXIgPSBmdW5jdGlvbiAoZikgeyBpZiAoZG9uZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBhZGQgaW5pdGlhbGl6ZXJzIGFmdGVyIGRlY29yYXRpb24gaGFzIGNvbXBsZXRlZFwiKTsgZXh0cmFJbml0aWFsaXplcnMucHVzaChhY2NlcHQoZiB8fCBudWxsKSk7IH07XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9ICgwLCBkZWNvcmF0b3JzW2ldKShraW5kID09PSBcImFjY2Vzc29yXCIgPyB7IGdldDogZGVzY3JpcHRvci5nZXQsIHNldDogZGVzY3JpcHRvci5zZXQgfSA6IGRlc2NyaXB0b3Jba2V5XSwgY29udGV4dCk7XHJcbiAgICAgICAgaWYgKGtpbmQgPT09IFwiYWNjZXNzb3JcIikge1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSB2b2lkIDApIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsIHx8IHR5cGVvZiByZXN1bHQgIT09IFwib2JqZWN0XCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5nZXQpKSBkZXNjcmlwdG9yLmdldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5zZXQpKSBkZXNjcmlwdG9yLnNldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5pbml0KSkgaW5pdGlhbGl6ZXJzLnB1c2goXyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKF8gPSBhY2NlcHQocmVzdWx0KSkge1xyXG4gICAgICAgICAgICBpZiAoa2luZCA9PT0gXCJmaWVsZFwiKSBpbml0aWFsaXplcnMucHVzaChfKTtcclxuICAgICAgICAgICAgZWxzZSBkZXNjcmlwdG9yW2tleV0gPSBfO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh0YXJnZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGNvbnRleHRJbi5uYW1lLCBkZXNjcmlwdG9yKTtcclxuICAgIGRvbmUgPSB0cnVlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcnVuSW5pdGlhbGl6ZXJzKHRoaXNBcmcsIGluaXRpYWxpemVycywgdmFsdWUpIHtcclxuICAgIHZhciB1c2VWYWx1ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbml0aWFsaXplcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YWx1ZSA9IHVzZVZhbHVlID8gaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZywgdmFsdWUpIDogaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdXNlVmFsdWUgPyB2YWx1ZSA6IHZvaWQgMDtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Byb3BLZXkoeCkge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSBcInN5bWJvbFwiID8geCA6IFwiXCIuY29uY2F0KHgpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc2V0RnVuY3Rpb25OYW1lKGYsIG5hbWUsIHByZWZpeCkge1xyXG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN5bWJvbFwiKSBuYW1lID0gbmFtZS5kZXNjcmlwdGlvbiA/IFwiW1wiLmNvbmNhdChuYW1lLmRlc2NyaXB0aW9uLCBcIl1cIikgOiBcIlwiO1xyXG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmLCBcIm5hbWVcIiwgeyBjb25maWd1cmFibGU6IHRydWUsIHZhbHVlOiBwcmVmaXggPyBcIlwiLmNvbmNhdChwcmVmaXgsIFwiIFwiLCBuYW1lKSA6IG5hbWUgfSk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaWYgKGdbbl0pIGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBmYWxzZSB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG4iLCJpbXBvcnQgeyBNYXJrZG93blJlbmRlcmVyLCBNb2RhbCwgUGx1Z2luXzIgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5jbGFzcyBDaGFuZ2Vsb2dNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbl8yLFxuICAgIHByaXZhdGUgdGl0bGU6IHN0cmluZyxcbiAgICBwcml2YXRlIGNvbnRlbnQ6IHN0cmluZyxcbiAgICBwcml2YXRlIGNiOiAoKSA9PiB2b2lkXG4gICkge1xuICAgIHN1cGVyKHBsdWdpbi5hcHApO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCkge1xuICAgIHRoaXMudGl0bGVFbC5zZXRUZXh0KHRoaXMudGl0bGUpO1xuXG4gICAgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihcbiAgICAgIHRoaXMuY29udGVudCxcbiAgICAgIHRoaXMuY29udGVudEVsLFxuICAgICAgXCJcIixcbiAgICAgIHRoaXMucGx1Z2luXG4gICAgKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKSB7XG4gICAgdGhpcy5jYigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVSZWxlYXNlcyhhOiBzdHJpbmcsIGI6IHN0cmluZykge1xuICBjb25zdCBbYU1ham9yLCBhTWlub3IsIGFQYXRjaF0gPSBhLnNwbGl0KFwiLlwiLCAzKS5tYXAoTnVtYmVyKTtcbiAgY29uc3QgW2JNYWpvciwgYk1pbm9yLCBiUGF0Y2hdID0gYi5zcGxpdChcIi5cIiwgMykubWFwKE51bWJlcik7XG5cbiAgaWYgKGFNYWpvciA9PT0gYk1ham9yKSB7XG4gICAgaWYgKGFNaW5vciA9PT0gYk1pbm9yKSB7XG4gICAgICByZXR1cm4gYVBhdGNoIC0gYlBhdGNoO1xuICAgIH1cblxuICAgIHJldHVybiBhTWlub3IgLSBiTWlub3I7XG4gIH1cblxuICByZXR1cm4gYU1ham9yIC0gYk1ham9yO1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhbmdlbG9nTW9kYWxGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgbW9kYWw6IENoYW5nZWxvZ01vZGFsIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwbHVnaW46IFBsdWdpbl8yLCBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UpIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInNob3ctY2hhbmdlbG9nXCIsXG4gICAgICBuYW1lOiBcIlNob3cgQ2hhbmdlbG9nXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gdGhpcy5zaG93TW9kYWwoKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNob3VsZFNob3cgPVxuICAgICAgY29tcGFyZVJlbGVhc2VzKFxuICAgICAgICBQTFVHSU5fVkVSU0lPTixcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5wcmV2aW91c1JlbGVhc2UgfHwgXCIwLjAuMFwiXG4gICAgICApID4gMDtcblxuICAgIGlmICghc2hvdWxkU2hvdykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc2hvd01vZGFsKHRoaXMuc2V0dGluZ3MucHJldmlvdXNSZWxlYXNlKTtcbiAgfVxuXG4gIHNob3dNb2RhbChwcmV2aW91c1JlbGVhc2U6IHN0cmluZyB8IG51bGwgPSBudWxsKSB7XG4gICAgY29uc3QgbWFya2Rvd24gPSBDSEFOR0VMT0dfTUQ7XG4gICAgY29uc3QgbGluZXMgPSBtYXJrZG93bi5zcGxpdChcIlxcblwiKTtcbiAgICBsZXQgbGFzdExpbmUgPSBsaW5lcy5sZW5ndGg7XG4gICAgaWYgKHByZXZpb3VzUmVsZWFzZSkge1xuICAgICAgY29uc3QgbGFzdExpbmVGb3VuZCA9IGxpbmVzLmZpbmRJbmRleChcbiAgICAgICAgKGxpbmUpID0+IGxpbmUuc3RhcnRzV2l0aChcIiNcIikgJiYgbGluZS5pbmNsdWRlcyhwcmV2aW91c1JlbGVhc2UpXG4gICAgICApO1xuICAgICAgaWYgKGxhc3RMaW5lRm91bmQgPj0gMCkge1xuICAgICAgICBsYXN0TGluZSA9IGxhc3RMaW5lRm91bmQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbW9kYWxUaXRsZSA9IGBXZWxjb21lIHRvIE9ic2lkaWFuIE91dGxpbmVyICR7UExVR0lOX1ZFUlNJT059YDtcbiAgICBjb25zdCBtb2RhbENvbnRlbnQgPSBsaW5lc1xuICAgICAgLnNsaWNlKDAsIGxhc3RMaW5lKVxuICAgICAgLmZpbHRlcigobCkgPT4gIS9eIytcXHMrXFxkK1xcLlxcZCtcXC5cXGQrJC8udGVzdChsKSlcbiAgICAgIC5qb2luKFwiXFxuXCIpXG4gICAgICAudHJpbSgpO1xuXG4gICAgaWYgKG1vZGFsQ29udGVudC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLm1vZGFsID0gbmV3IENoYW5nZWxvZ01vZGFsKFxuICAgICAgdGhpcy5wbHVnaW4sXG4gICAgICBtb2RhbFRpdGxlLFxuICAgICAgbW9kYWxDb250ZW50LFxuICAgICAgdGhpcy5oYW5kbGVDbG9zZVxuICAgICk7XG4gICAgdGhpcy5tb2RhbC5vcGVuKCk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgaWYgKCF0aGlzLm1vZGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbW9kYWwgPSB0aGlzLm1vZGFsO1xuICAgIHRoaXMubW9kYWwgPSBudWxsO1xuICAgIG1vZGFsLmNsb3NlKCk7XG4gIH1cblxuICBoYW5kbGVDbG9zZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXRoaXMubW9kYWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnNldHRpbmdzLnByZXZpb3VzUmVsZWFzZSA9IFBMVUdJTl9WRVJTSU9OO1xuICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgTGlzdCwgUm9vdCB9IGZyb20gXCIuXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3Q6IFJvb3QpIHtcbiAgZnVuY3Rpb24gdmlzaXQocGFyZW50OiBSb290IHwgTGlzdCkge1xuICAgIGxldCBpbmRleCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHBhcmVudC5nZXRDaGlsZHJlbigpKSB7XG4gICAgICBpZiAoL1xcZCtcXC4vLnRlc3QoY2hpbGQuZ2V0QnVsbGV0KCkpKSB7XG4gICAgICAgIGNoaWxkLnJlcGxhdGVCdWxsZXQoYCR7aW5kZXgrK30uYCk7XG4gICAgICB9XG5cbiAgICAgIHZpc2l0KGNoaWxkKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdChyb290KTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBMaXN0LCBMaXN0TGluZSwgUG9zaXRpb24sIFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290L3JlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHNcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZUFuZE1lcmdlV2l0aFByZXZpb3VzTGluZU9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgbGluZXMgPSBsaXN0LmdldExpbmVzSW5mbygpO1xuXG4gICAgY29uc3QgbGluZU5vID0gbGluZXMuZmluZEluZGV4KFxuICAgICAgKGwpID0+IGN1cnNvci5jaCA9PT0gbC5mcm9tLmNoICYmIGN1cnNvci5saW5lID09PSBsLmZyb20ubGluZVxuICAgICk7XG5cbiAgICBpZiAobGluZU5vID09PSAwKSB7XG4gICAgICB0aGlzLm1lcmdlV2l0aFByZXZpb3VzSXRlbShyb290LCBjdXJzb3IsIGxpc3QpO1xuICAgIH0gZWxzZSBpZiAobGluZU5vID4gMCkge1xuICAgICAgdGhpcy5tZXJnZU5vdGVzKHJvb3QsIGN1cnNvciwgbGlzdCwgbGluZXMsIGxpbmVObyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBtZXJnZU5vdGVzKFxuICAgIHJvb3Q6IFJvb3QsXG4gICAgY3Vyc29yOiBQb3NpdGlvbixcbiAgICBsaXN0OiBMaXN0LFxuICAgIGxpbmVzOiBMaXN0TGluZVtdLFxuICAgIGxpbmVObzogbnVtYmVyXG4gICkge1xuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgcHJldkxpbmVObyA9IGxpbmVObyAtIDE7XG5cbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgLSAxLFxuICAgICAgY2g6IGxpbmVzW3ByZXZMaW5lTm9dLnRleHQubGVuZ3RoICsgbGluZXNbcHJldkxpbmVOb10uZnJvbS5jaCxcbiAgICB9KTtcblxuICAgIGxpbmVzW3ByZXZMaW5lTm9dLnRleHQgKz0gbGluZXNbbGluZU5vXS50ZXh0O1xuICAgIGxpbmVzLnNwbGljZShsaW5lTm8sIDEpO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMubWFwKChsKSA9PiBsLnRleHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgbWVyZ2VXaXRoUHJldmlvdXNJdGVtKHJvb3Q6IFJvb3QsIGN1cnNvcjogUG9zaXRpb24sIGxpc3Q6IExpc3QpIHtcbiAgICBpZiAocm9vdC5nZXRDaGlsZHJlbigpWzBdID09PSBsaXN0ICYmIGxpc3QuaXNFbXB0eSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgcHJldiA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSAtIDEpO1xuXG4gICAgaWYgKCFwcmV2KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYm90aEFyZUVtcHR5ID0gcHJldi5pc0VtcHR5KCkgJiYgbGlzdC5pc0VtcHR5KCk7XG4gICAgY29uc3QgcHJldklzRW1wdHlBbmRTYW1lTGV2ZWwgPVxuICAgICAgcHJldi5pc0VtcHR5KCkgJiYgIWxpc3QuaXNFbXB0eSgpICYmIHByZXYuZ2V0TGV2ZWwoKSA9PSBsaXN0LmdldExldmVsKCk7XG4gICAgY29uc3QgbGlzdElzRW1wdHlBbmRQcmV2SXNQYXJlbnQgPVxuICAgICAgbGlzdC5pc0VtcHR5KCkgJiYgcHJldi5nZXRMZXZlbCgpID09IGxpc3QuZ2V0TGV2ZWwoKSAtIDE7XG5cbiAgICBpZiAoYm90aEFyZUVtcHR5IHx8IHByZXZJc0VtcHR5QW5kU2FtZUxldmVsIHx8IGxpc3RJc0VtcHR5QW5kUHJldklzUGFyZW50KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgICAgY29uc3QgcHJldkVuZCA9IHByZXYuZ2V0TGFzdExpbmVDb250ZW50RW5kKCk7XG5cbiAgICAgIGlmICghcHJldi5nZXROb3Rlc0luZGVudCgpICYmIGxpc3QuZ2V0Tm90ZXNJbmRlbnQoKSkge1xuICAgICAgICBwcmV2LnNldE5vdGVzSW5kZW50KFxuICAgICAgICAgIHByZXYuZ2V0Rmlyc3RMaW5lSW5kZW50KCkgK1xuICAgICAgICAgICAgbGlzdC5nZXROb3Rlc0luZGVudCgpLnNsaWNlKGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoKVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lcyA9IHByZXYuZ2V0TGluZXMoKTtcbiAgICAgIGNvbnN0IG5ld0xpbmVzID0gbGlzdC5nZXRMaW5lcygpO1xuICAgICAgb2xkTGluZXNbb2xkTGluZXMubGVuZ3RoIC0gMV0gKz0gbmV3TGluZXNbMF07XG4gICAgICBjb25zdCByZXN1bHRMaW5lcyA9IG9sZExpbmVzLmNvbmNhdChuZXdMaW5lcy5zbGljZSgxKSk7XG5cbiAgICAgIHByZXYucmVwbGFjZUxpbmVzKHJlc3VsdExpbmVzKTtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcblxuICAgICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgICBsaXN0LnJlbW92ZUNoaWxkKGMpO1xuICAgICAgICBwcmV2LmFkZEFmdGVyQWxsKGMpO1xuICAgICAgfVxuXG4gICAgICByb290LnJlcGxhY2VDdXJzb3IocHJldkVuZCk7XG5cbiAgICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBEZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91c0xpbmVPcGVyYXRpb24gfSBmcm9tIFwiLi9EZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91c0xpbmVPcGVyYXRpb25cIjtcbmltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZUFuZE1lcmdlV2l0aE5leHRMaW5lT3BlcmF0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBkZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91czogRGVsZXRlQW5kTWVyZ2VXaXRoUHJldmlvdXNMaW5lT3BlcmF0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge1xuICAgIHRoaXMuZGVsZXRlQW5kTWVyZ2VXaXRoUHJldmlvdXMgPVxuICAgICAgbmV3IERlbGV0ZUFuZE1lcmdlV2l0aFByZXZpb3VzTGluZU9wZXJhdGlvbihyb290KTtcbiAgfVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5kZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91cy5zaG91bGRTdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5kZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91cy5zaG91bGRVcGRhdGUoKTtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoXG4gICAgICAobCkgPT4gY3Vyc29yLmNoID09PSBsLnRvLmNoICYmIGN1cnNvci5saW5lID09PSBsLnRvLmxpbmVcbiAgICApO1xuXG4gICAgaWYgKGxpbmVObyA9PT0gbGluZXMubGVuZ3RoIC0gMSkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tsaW5lTm9dLnRvLmxpbmUgKyAxO1xuICAgICAgY29uc3QgbmV4dExpc3QgPSByb290LmdldExpc3RVbmRlckxpbmUobmV4dExpbmUpO1xuICAgICAgaWYgKCFuZXh0TGlzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByb290LnJlcGxhY2VDdXJzb3IobmV4dExpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkpO1xuICAgICAgdGhpcy5kZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91cy5wZXJmb3JtKCk7XG4gICAgfSBlbHNlIGlmIChsaW5lTm8gPj0gMCkge1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGxpbmVzW2xpbmVObyArIDFdLmZyb20pO1xuICAgICAgdGhpcy5kZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91cy5wZXJmb3JtKCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVUaWxsTGluZVN0YXJ0T3BlcmF0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoKGwpID0+IGwuZnJvbS5saW5lID09PSBjdXJzb3IubGluZSk7XG5cbiAgICBsaW5lc1tsaW5lTm9dLnRleHQgPSBsaW5lc1tsaW5lTm9dLnRleHQuc2xpY2UoXG4gICAgICBjdXJzb3IuY2ggLSBsaW5lc1tsaW5lTm9dLmZyb20uY2hcbiAgICApO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMubWFwKChsKSA9PiBsLnRleHQpKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3IobGluZXNbbGluZU5vXS5mcm9tKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luXzIgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vTXlFZGl0b3JcIjtcbmltcG9ydCB7IERlbGV0ZUFuZE1lcmdlV2l0aE5leHRMaW5lT3BlcmF0aW9uIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvRGVsZXRlQW5kTWVyZ2VXaXRoTmV4dExpbmVPcGVyYXRpb25cIjtcbmltcG9ydCB7IERlbGV0ZUFuZE1lcmdlV2l0aFByZXZpb3VzTGluZU9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0RlbGV0ZUFuZE1lcmdlV2l0aFByZXZpb3VzTGluZU9wZXJhdGlvblwiO1xuaW1wb3J0IHsgRGVsZXRlVGlsbExpbmVTdGFydE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0RlbGV0ZVRpbGxMaW5lU3RhcnRPcGVyYXRpb25cIjtcbmltcG9ydCB7IElNRVNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FU2VydmljZVwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2VydmljZVwiO1xuaW1wb3J0IHsgUGVyZm9ybU9wZXJhdGlvblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcIjtcbmltcG9ydCB7IFNldHRpbmdzU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1NlcnZpY2VcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZVNob3VsZElnbm9yZUJ1bGxldHNGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW5fMixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UsXG4gICAgcHJpdmF0ZSBpbWU6IElNRVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBvYnNpZGlhbjogT2JzaWRpYW5TZXJ2aWNlLFxuICAgIHByaXZhdGUgcGVyZm9ybU9wZXJhdGlvbjogUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcIkJhY2tzcGFjZVwiLFxuICAgICAgICAgIHJ1bjogdGhpcy5vYnNpZGlhbi5jcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgIHJ1bjogdGhpcy5kZWxldGVBbmRNZXJnZVdpdGhQcmV2aW91c0xpbmUsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6IFwiRGVsZXRlXCIsXG4gICAgICAgICAgcnVuOiB0aGlzLm9ic2lkaWFuLmNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLmRlbGV0ZUFuZE1lcmdlV2l0aE5leHRMaW5lLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbWFjOiBcIm0tQmFja3NwYWNlXCIsXG4gICAgICAgICAgcnVuOiB0aGlzLm9ic2lkaWFuLmNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLmRlbGV0ZVRpbGxMaW5lU3RhcnQsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICBdKVxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3Muc3RpY2tDdXJzb3IgIT0gXCJuZXZlclwiICYmICF0aGlzLmltZS5pc0lNRU9wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgZGVsZXRlQW5kTWVyZ2VXaXRoUHJldmlvdXNMaW5lID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5wZXJmb3JtT3BlcmF0aW9uLnBlcmZvcm1PcGVyYXRpb24oXG4gICAgICAocm9vdCkgPT4gbmV3IERlbGV0ZUFuZE1lcmdlV2l0aFByZXZpb3VzTGluZU9wZXJhdGlvbihyb290KSxcbiAgICAgIGVkaXRvclxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBkZWxldGVUaWxsTGluZVN0YXJ0ID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5wZXJmb3JtT3BlcmF0aW9uLnBlcmZvcm1PcGVyYXRpb24oXG4gICAgICAocm9vdCkgPT4gbmV3IERlbGV0ZVRpbGxMaW5lU3RhcnRPcGVyYXRpb24ocm9vdCksXG4gICAgICBlZGl0b3JcbiAgICApO1xuICB9O1xuXG4gIHByaXZhdGUgZGVsZXRlQW5kTWVyZ2VXaXRoTmV4dExpbmUgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLnBlcmZvcm1PcGVyYXRpb24ucGVyZm9ybU9wZXJhdGlvbihcbiAgICAgIChyb290KSA9PiBuZXcgRGVsZXRlQW5kTWVyZ2VXaXRoTmV4dExpbmVPcGVyYXRpb24ocm9vdCksXG4gICAgICBlZGl0b3JcbiAgICApO1xuICB9O1xufVxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzICovXG5pbXBvcnQgeyBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHtcbiAgZm9sZEVmZmVjdCxcbiAgZm9sZGFibGUsXG4gIGZvbGRlZFJhbmdlcyxcbiAgdW5mb2xkRWZmZWN0LFxufSBmcm9tIFwiQGNvZGVtaXJyb3IvbGFuZ3VhZ2VcIjtcbmltcG9ydCB7IEVkaXRvclZpZXcsIHJ1blNjb3BlSGFuZGxlcnMgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3JQb3NpdGlvbiB7XG4gIGxpbmU6IG51bWJlcjtcbiAgY2g6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIE15RWRpdG9yUmFuZ2Uge1xuICBmcm9tOiBNeUVkaXRvclBvc2l0aW9uO1xuICB0bzogTXlFZGl0b3JQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIE15RWRpdG9yU2VsZWN0aW9uIHtcbiAgYW5jaG9yOiBNeUVkaXRvclBvc2l0aW9uO1xuICBoZWFkOiBNeUVkaXRvclBvc2l0aW9uO1xufVxuXG5mdW5jdGlvbiBmb2xkSW5zaWRlKHZpZXc6IEVkaXRvclZpZXcsIGZyb206IG51bWJlciwgdG86IG51bWJlcikge1xuICBsZXQgZm91bmQ6IHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcbiAgZm9sZGVkUmFuZ2VzKHZpZXcuc3RhdGUpLmJldHdlZW4oZnJvbSwgdG8sIChmcm9tLCB0bykgPT4ge1xuICAgIGlmICghZm91bmQgfHwgZm91bmQuZnJvbSA+IGZyb20pIGZvdW5kID0geyBmcm9tLCB0byB9O1xuICB9KTtcbiAgcmV0dXJuIGZvdW5kO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3Ige1xuICBwcml2YXRlIHZpZXc6IEVkaXRvclZpZXc7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBlOiBFZGl0b3IpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIHRoaXMudmlldyA9ICh0aGlzLmUgYXMgYW55KS5jbTtcbiAgfVxuXG4gIGdldEN1cnNvcigpOiBNeUVkaXRvclBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldEN1cnNvcigpO1xuICB9XG5cbiAgZ2V0TGluZShuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0TGluZShuKTtcbiAgfVxuXG4gIGxhc3RMaW5lKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZS5sYXN0TGluZSgpO1xuICB9XG5cbiAgbGlzdFNlbGVjdGlvbnMoKTogTXlFZGl0b3JTZWxlY3Rpb25bXSB7XG4gICAgcmV0dXJuIHRoaXMuZS5saXN0U2VsZWN0aW9ucygpO1xuICB9XG5cbiAgZ2V0UmFuZ2UoZnJvbTogTXlFZGl0b3JQb3NpdGlvbiwgdG86IE15RWRpdG9yUG9zaXRpb24pOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0UmFuZ2UoZnJvbSwgdG8pO1xuICB9XG5cbiAgcmVwbGFjZVJhbmdlKFxuICAgIHJlcGxhY2VtZW50OiBzdHJpbmcsXG4gICAgZnJvbTogTXlFZGl0b3JQb3NpdGlvbixcbiAgICB0bzogTXlFZGl0b3JQb3NpdGlvblxuICApOiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5lLnJlcGxhY2VSYW5nZShyZXBsYWNlbWVudCwgZnJvbSwgdG8pO1xuICB9XG5cbiAgc2V0U2VsZWN0aW9ucyhzZWxlY3Rpb25zOiBNeUVkaXRvclNlbGVjdGlvbltdKTogdm9pZCB7XG4gICAgdGhpcy5lLnNldFNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG4gIH1cblxuICBzZXRWYWx1ZSh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmUuc2V0VmFsdWUodGV4dCk7XG4gIH1cblxuICBnZXRWYWx1ZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0VmFsdWUoKTtcbiAgfVxuXG4gIG9mZnNldFRvUG9zKG9mZnNldDogbnVtYmVyKTogTXlFZGl0b3JQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHRoaXMuZS5vZmZzZXRUb1BvcyhvZmZzZXQpO1xuICB9XG5cbiAgcG9zVG9PZmZzZXQocG9zOiBNeUVkaXRvclBvc2l0aW9uKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5lLnBvc1RvT2Zmc2V0KHBvcyk7XG4gIH1cblxuICBmb2xkKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgdmlldyB9ID0gdGhpcztcbiAgICBjb25zdCBsID0gdmlldy5saW5lQmxvY2tBdCh2aWV3LnN0YXRlLmRvYy5saW5lKG4gKyAxKS5mcm9tKTtcbiAgICBjb25zdCByYW5nZSA9IGZvbGRhYmxlKHZpZXcuc3RhdGUsIGwuZnJvbSwgbC50byk7XG5cbiAgICBpZiAoIXJhbmdlIHx8IHJhbmdlLmZyb20gPT09IHJhbmdlLnRvKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmlldy5kaXNwYXRjaCh7IGVmZmVjdHM6IFtmb2xkRWZmZWN0Lm9mKHJhbmdlKV0gfSk7XG4gIH1cblxuICB1bmZvbGQobjogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgeyB2aWV3IH0gPSB0aGlzO1xuICAgIGNvbnN0IGwgPSB2aWV3LmxpbmVCbG9ja0F0KHZpZXcuc3RhdGUuZG9jLmxpbmUobiArIDEpLmZyb20pO1xuICAgIGNvbnN0IHJhbmdlID0gZm9sZEluc2lkZSh2aWV3LCBsLmZyb20sIGwudG8pO1xuXG4gICAgaWYgKCFyYW5nZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZpZXcuZGlzcGF0Y2goeyBlZmZlY3RzOiBbdW5mb2xkRWZmZWN0Lm9mKHJhbmdlKV0gfSk7XG4gIH1cblxuICBnZXRBbGxGb2xkZWRMaW5lcygpOiBudW1iZXJbXSB7XG4gICAgY29uc3QgYyA9IGZvbGRlZFJhbmdlcyh0aGlzLnZpZXcuc3RhdGUpLml0ZXIoKTtcbiAgICBjb25zdCByZXM6IG51bWJlcltdID0gW107XG4gICAgd2hpbGUgKGMudmFsdWUpIHtcbiAgICAgIHJlcy5wdXNoKHRoaXMub2Zmc2V0VG9Qb3MoYy5mcm9tKS5saW5lKTtcbiAgICAgIGMubmV4dCgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgdHJpZ2dlck9uS2V5RG93bihlOiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgcnVuU2NvcGVIYW5kbGVycyh0aGlzLnZpZXcsIGUsIFwiZWRpdG9yXCIpO1xuICB9XG5cbiAgZ2V0Wm9vbVJhbmdlKCk6IE15RWRpdG9yUmFuZ2UgfCBudWxsIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IGFwaSA9ICh3aW5kb3cgYXMgYW55KS5PYnNpZGlhblpvb21QbHVnaW47XG5cbiAgICBpZiAoIWFwaSB8fCAhYXBpLmdldFpvb21SYW5nZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFwaS5nZXRab29tUmFuZ2UodGhpcy5lKTtcbiAgfVxuXG4gIHpvb21PdXQoKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBhcGkgPSAod2luZG93IGFzIGFueSkuT2JzaWRpYW5ab29tUGx1Z2luO1xuXG4gICAgaWYgKCFhcGkgfHwgIWFwaS56b29tT3V0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXBpLnpvb21PdXQodGhpcy5lKTtcbiAgfVxuXG4gIHpvb21JbihsaW5lOiBudW1iZXIpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IGFwaSA9ICh3aW5kb3cgYXMgYW55KS5PYnNpZGlhblpvb21QbHVnaW47XG5cbiAgICBpZiAoIWFwaSB8fCAhYXBpLnpvb21Jbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGFwaS56b29tSW4odGhpcy5lLCBsaW5lKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IExpc3QsIFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290L3JlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHNcIjtcblxuaW50ZXJmYWNlIEN1cnNvckFuY2hvciB7XG4gIGN1cnNvckxpc3Q6IExpc3Q7XG4gIGxpbmVEaWZmOiBudW1iZXI7XG4gIGNoRGlmZjogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTW92ZUxpc3RUb0RpZmZlcmVudFBvc2l0aW9uT3BlcmF0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgbGlzdFRvTW92ZTogTGlzdCxcbiAgICBwcml2YXRlIHBsYWNlVG9Nb3ZlOiBMaXN0LFxuICAgIHByaXZhdGUgd2hlcmVUb01vdmU6IFwiYmVmb3JlXCIgfCBcImFmdGVyXCIgfCBcImluc2lkZVwiLFxuICAgIHByaXZhdGUgZGVmYXVsdEluZGVudENoYXJzOiBzdHJpbmdcbiAgKSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgaWYgKHRoaXMubGlzdFRvTW92ZSA9PT0gdGhpcy5wbGFjZVRvTW92ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgY3Vyc29yQW5jaG9yID0gdGhpcy5jYWxjdWxhdGVDdXJzb3JBbmNob3IoKTtcbiAgICB0aGlzLm1vdmVMaXN0KCk7XG4gICAgdGhpcy5jaGFuZ2VJbmRlbnQoKTtcbiAgICB0aGlzLnJlc3RvcmVDdXJzb3IoY3Vyc29yQW5jaG9yKTtcbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHRoaXMucm9vdCk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUN1cnNvckFuY2hvcigpOiBDdXJzb3JBbmNob3Ige1xuICAgIGNvbnN0IGN1cnNvckxpbmUgPSB0aGlzLnJvb3QuZ2V0Q3Vyc29yKCkubGluZTtcblxuICAgIGNvbnN0IGxpbmVzID0gW1xuICAgICAgdGhpcy5saXN0VG9Nb3ZlLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICB0aGlzLmxpc3RUb01vdmUuZ2V0TGFzdExpbmVDb250ZW50RW5kKCkubGluZSxcbiAgICAgIHRoaXMucGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSxcbiAgICAgIHRoaXMucGxhY2VUb01vdmUuZ2V0TGFzdExpbmVDb250ZW50RW5kKCkubGluZSxcbiAgICBdO1xuICAgIGNvbnN0IGxpc3RTdGFydExpbmUgPSBNYXRoLm1pbiguLi5saW5lcyk7XG4gICAgY29uc3QgbGlzdEVuZExpbmUgPSBNYXRoLm1heCguLi5saW5lcyk7XG5cbiAgICBpZiAoY3Vyc29yTGluZSA8IGxpc3RTdGFydExpbmUgfHwgY3Vyc29yTGluZSA+IGxpc3RFbmRMaW5lKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLnJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yTGlzdCA9IHRoaXMucm9vdC5nZXRMaXN0VW5kZXJMaW5lKGN1cnNvci5saW5lKTtcbiAgICBjb25zdCBjdXJzb3JMaXN0U3RhcnQgPSBjdXJzb3JMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gY3Vyc29yLmxpbmUgLSBjdXJzb3JMaXN0U3RhcnQubGluZTtcbiAgICBjb25zdCBjaERpZmYgPSBjdXJzb3IuY2ggLSBjdXJzb3JMaXN0U3RhcnQuY2g7XG5cbiAgICByZXR1cm4geyBjdXJzb3JMaXN0LCBsaW5lRGlmZiwgY2hEaWZmIH07XG4gIH1cblxuICBwcml2YXRlIG1vdmVMaXN0KCkge1xuICAgIHRoaXMubGlzdFRvTW92ZS5nZXRQYXJlbnQoKS5yZW1vdmVDaGlsZCh0aGlzLmxpc3RUb01vdmUpO1xuXG4gICAgc3dpdGNoICh0aGlzLndoZXJlVG9Nb3ZlKSB7XG4gICAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICAgIHRoaXMucGxhY2VUb01vdmVcbiAgICAgICAgICAuZ2V0UGFyZW50KClcbiAgICAgICAgICAuYWRkQmVmb3JlKHRoaXMucGxhY2VUb01vdmUsIHRoaXMubGlzdFRvTW92ZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgICAgdGhpcy5wbGFjZVRvTW92ZVxuICAgICAgICAgIC5nZXRQYXJlbnQoKVxuICAgICAgICAgIC5hZGRBZnRlcih0aGlzLnBsYWNlVG9Nb3ZlLCB0aGlzLmxpc3RUb01vdmUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcImluc2lkZVwiOlxuICAgICAgICB0aGlzLnBsYWNlVG9Nb3ZlLmFkZEJlZm9yZUFsbCh0aGlzLmxpc3RUb01vdmUpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNoYW5nZUluZGVudCgpIHtcbiAgICBjb25zdCBvbGRJbmRlbnQgPSB0aGlzLmxpc3RUb01vdmUuZ2V0Rmlyc3RMaW5lSW5kZW50KCk7XG4gICAgY29uc3QgbmV3SW5kZW50ID1cbiAgICAgIHRoaXMud2hlcmVUb01vdmUgPT09IFwiaW5zaWRlXCJcbiAgICAgICAgPyB0aGlzLnBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUluZGVudCgpICsgdGhpcy5kZWZhdWx0SW5kZW50Q2hhcnNcbiAgICAgICAgOiB0aGlzLnBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUluZGVudCgpO1xuICAgIHRoaXMubGlzdFRvTW92ZS51bmluZGVudENvbnRlbnQoMCwgb2xkSW5kZW50Lmxlbmd0aCk7XG4gICAgdGhpcy5saXN0VG9Nb3ZlLmluZGVudENvbnRlbnQoMCwgbmV3SW5kZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzdG9yZUN1cnNvcihjdXJzb3JBbmNob3I6IEN1cnNvckFuY2hvcikge1xuICAgIGlmIChjdXJzb3JBbmNob3IpIHtcbiAgICAgIGNvbnN0IGN1cnNvckxpc3RTdGFydCA9XG4gICAgICAgIGN1cnNvckFuY2hvci5jdXJzb3JMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpO1xuXG4gICAgICB0aGlzLnJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICAgIGxpbmU6IGN1cnNvckxpc3RTdGFydC5saW5lICsgY3Vyc29yQW5jaG9yLmxpbmVEaWZmLFxuICAgICAgICBjaDogY3Vyc29yTGlzdFN0YXJ0LmNoICsgY3Vyc29yQW5jaG9yLmNoRGlmZixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXaGVuIHlvdSBtb3ZlIGEgbGlzdCwgdGhlIHNjcmVlbiBzY3JvbGxzIHRvIHRoZSBjdXJzb3IuXG4gICAgICAvLyBJdCBpcyBiZXR0ZXIgdG8gbW92ZSB0aGUgY3Vyc29yIGludG8gdGhlIHZpZXdwb3J0IHRoYW4gbGV0IHRoZSBzY3JlZW4gc2Nyb2xsLlxuICAgICAgdGhpcy5yb290LnJlcGxhY2VDdXJzb3IodGhpcy5saXN0VG9Nb3ZlLmdldExhc3RMaW5lQ29udGVudEVuZCgpKTtcbiAgICB9XG4gIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBjbXBQb3MoYTogUG9zaXRpb24sIGI6IFBvc2l0aW9uKSB7XG4gIHJldHVybiBhLmxpbmUgLSBiLmxpbmUgfHwgYS5jaCAtIGIuY2g7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXhQb3MoYTogUG9zaXRpb24sIGI6IFBvc2l0aW9uKSB7XG4gIHJldHVybiBjbXBQb3MoYSwgYikgPCAwID8gYiA6IGE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtaW5Qb3MoYTogUG9zaXRpb24sIGI6IFBvc2l0aW9uKSB7XG4gIHJldHVybiBjbXBQb3MoYSwgYikgPCAwID8gYSA6IGI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Jhbmdlc0ludGVyc2VjdHMoXG4gIGE6IFtQb3NpdGlvbiwgUG9zaXRpb25dLFxuICBiOiBbUG9zaXRpb24sIFBvc2l0aW9uXVxuKSB7XG4gIHJldHVybiBjbXBQb3MoYVsxXSwgYlswXSkgPj0gMCAmJiBjbXBQb3MoYVswXSwgYlsxXSkgPD0gMDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQb3NpdGlvbiB7XG4gIGNoOiBudW1iZXI7XG4gIGxpbmU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMaXN0TGluZSB7XG4gIHRleHQ6IHN0cmluZztcbiAgZnJvbTogUG9zaXRpb247XG4gIHRvOiBQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSYW5nZSB7XG4gIGFuY2hvcjogUG9zaXRpb247XG4gIGhlYWQ6IFBvc2l0aW9uO1xufVxuXG5sZXQgaWRTZXEgPSAwO1xuXG5leHBvcnQgY2xhc3MgTGlzdCB7XG4gIHByaXZhdGUgaWQ6IG51bWJlcjtcbiAgcHJpdmF0ZSBwYXJlbnQ6IExpc3QgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjaGlsZHJlbjogTGlzdFtdID0gW107XG4gIHByaXZhdGUgbm90ZXNJbmRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcm9vdDogUm9vdCxcbiAgICBwcml2YXRlIGluZGVudDogc3RyaW5nLFxuICAgIHByaXZhdGUgYnVsbGV0OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBvcHRpb25hbENoZWNrYm94OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBzcGFjZUFmdGVyQnVsbGV0OiBzdHJpbmcsXG4gICAgZmlyc3RMaW5lOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBmb2xkUm9vdDogYm9vbGVhblxuICApIHtcbiAgICB0aGlzLmlkID0gaWRTZXErKztcbiAgICB0aGlzLmxpbmVzLnB1c2goZmlyc3RMaW5lKTtcbiAgfVxuXG4gIGdldElEKCkge1xuICAgIHJldHVybiB0aGlzLmlkO1xuICB9XG5cbiAgZ2V0Tm90ZXNJbmRlbnQoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubm90ZXNJbmRlbnQ7XG4gIH1cblxuICBzZXROb3Rlc0luZGVudChub3Rlc0luZGVudDogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMubm90ZXNJbmRlbnQgIT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm90ZXMgaW5kZW50IGFscmVhZHkgcHJvdmlkZWRgKTtcbiAgICB9XG4gICAgdGhpcy5ub3Rlc0luZGVudCA9IG5vdGVzSW5kZW50O1xuICB9XG5cbiAgYWRkTGluZSh0ZXh0OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVW5hYmxlIHRvIGFkZCBsaW5lLCBub3RlcyBpbmRlbnQgc2hvdWxkIGJlIHByb3ZpZGVkIGZpcnN0YFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmxpbmVzLnB1c2godGV4dCk7XG4gIH1cblxuICByZXBsYWNlTGluZXMobGluZXM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKGxpbmVzLmxlbmd0aCA+IDEgJiYgdGhpcy5ub3Rlc0luZGVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVW5hYmxlIHRvIGFkZCBsaW5lLCBub3RlcyBpbmRlbnQgc2hvdWxkIGJlIHByb3ZpZGVkIGZpcnN0YFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmxpbmVzID0gbGluZXM7XG4gIH1cblxuICBnZXRMaW5lQ291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMubGluZXMubGVuZ3RoO1xuICB9XG5cbiAgZ2V0Um9vdCgpIHtcbiAgICByZXR1cm4gdGhpcy5yb290O1xuICB9XG5cbiAgZ2V0Q2hpbGRyZW4oKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uY29uY2F0KCk7XG4gIH1cblxuICBnZXRMaW5lc0luZm8oKTogTGlzdExpbmVbXSB7XG4gICAgY29uc3Qgc3RhcnRMaW5lID0gdGhpcy5yb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YodGhpcylbMF07XG5cbiAgICByZXR1cm4gdGhpcy5saW5lcy5tYXAoKHJvdywgaSkgPT4ge1xuICAgICAgY29uc3QgbGluZSA9IHN0YXJ0TGluZSArIGk7XG4gICAgICBjb25zdCBzdGFydENoID1cbiAgICAgICAgaSA9PT0gMCA/IHRoaXMuZ2V0Q29udGVudFN0YXJ0Q2goKSA6IHRoaXMubm90ZXNJbmRlbnQubGVuZ3RoO1xuICAgICAgY29uc3QgZW5kQ2ggPSBzdGFydENoICsgcm93Lmxlbmd0aDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdGV4dDogcm93LFxuICAgICAgICBmcm9tOiB7IGxpbmUsIGNoOiBzdGFydENoIH0sXG4gICAgICAgIHRvOiB7IGxpbmUsIGNoOiBlbmRDaCB9LFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldExpbmVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy5saW5lcy5jb25jYXQoKTtcbiAgfVxuXG4gIGdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpIHtcbiAgICBjb25zdCBzdGFydExpbmUgPSB0aGlzLnJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZih0aGlzKVswXTtcblxuICAgIHJldHVybiB7XG4gICAgICBsaW5lOiBzdGFydExpbmUsXG4gICAgICBjaDogdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpLFxuICAgIH07XG4gIH1cblxuICBnZXRGaXJzdExpbmVDb250ZW50U3RhcnRBZnRlckNoZWNrYm94KCkge1xuICAgIGNvbnN0IHN0YXJ0TGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzBdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmU6IHN0YXJ0TGluZSxcbiAgICAgIGNoOiB0aGlzLmdldENvbnRlbnRTdGFydENoKCkgKyB0aGlzLm9wdGlvbmFsQ2hlY2tib3gubGVuZ3RoLFxuICAgIH07XG4gIH1cblxuICBnZXRMYXN0TGluZUNvbnRlbnRFbmQoKSB7XG4gICAgY29uc3QgZW5kTGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzFdO1xuICAgIGNvbnN0IGVuZENoID1cbiAgICAgIHRoaXMubGluZXMubGVuZ3RoID09PSAxXG4gICAgICAgID8gdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpICsgdGhpcy5saW5lc1swXS5sZW5ndGhcbiAgICAgICAgOiB0aGlzLm5vdGVzSW5kZW50Lmxlbmd0aCArIHRoaXMubGluZXNbdGhpcy5saW5lcy5sZW5ndGggLSAxXS5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbGluZTogZW5kTGluZSxcbiAgICAgIGNoOiBlbmRDaCxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkge1xuICAgIHJldHVybiB0aGlzLmdldExhc3RDaGlsZCgpLmdldExhc3RMaW5lQ29udGVudEVuZCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMYXN0Q2hpbGQoKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby10aGlzLWFsaWFzXG4gICAgbGV0IGxhc3RDaGlsZDogTGlzdCA9IHRoaXM7XG5cbiAgICB3aGlsZSAoIWxhc3RDaGlsZC5pc0VtcHR5KCkpIHtcbiAgICAgIGxhc3RDaGlsZCA9IGxhc3RDaGlsZC5nZXRDaGlsZHJlbigpLmxhc3QoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGFzdENoaWxkO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDb250ZW50U3RhcnRDaCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRlbnQubGVuZ3RoICsgdGhpcy5idWxsZXQubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGlzRm9sZGVkKCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLmZvbGRSb290KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcmVudC5pc0ZvbGRlZCgpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzRm9sZFJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuZm9sZFJvb3Q7XG4gIH1cblxuICBnZXRUb3BGb2xkUm9vdCgpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXRoaXMtYWxpYXNcbiAgICBsZXQgdG1wOiBMaXN0ID0gdGhpcztcbiAgICBsZXQgZm9sZFJvb3Q6IExpc3QgfCBudWxsID0gbnVsbDtcbiAgICB3aGlsZSAodG1wKSB7XG4gICAgICBpZiAodG1wLmlzRm9sZFJvb3QoKSkge1xuICAgICAgICBmb2xkUm9vdCA9IHRtcDtcbiAgICAgIH1cbiAgICAgIHRtcCA9IHRtcC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBmb2xkUm9vdDtcbiAgfVxuXG4gIGdldExldmVsKCk6IG51bWJlciB7XG4gICAgaWYgKCF0aGlzLnBhcmVudCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucGFyZW50LmdldExldmVsKCkgKyAxO1xuICB9XG5cbiAgdW5pbmRlbnRDb250ZW50KGZyb206IG51bWJlciwgdGlsbDogbnVtYmVyKSB7XG4gICAgdGhpcy5pbmRlbnQgPSB0aGlzLmluZGVudC5zbGljZSgwLCBmcm9tKSArIHRoaXMuaW5kZW50LnNsaWNlKHRpbGwpO1xuICAgIGlmICh0aGlzLm5vdGVzSW5kZW50ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGVzSW5kZW50ID1cbiAgICAgICAgdGhpcy5ub3Rlc0luZGVudC5zbGljZSgwLCBmcm9tKSArIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UodGlsbCk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKSB7XG4gICAgICBjaGlsZC51bmluZGVudENvbnRlbnQoZnJvbSwgdGlsbCk7XG4gICAgfVxuICB9XG5cbiAgaW5kZW50Q29udGVudChpbmRlbnRQb3M6IG51bWJlciwgaW5kZW50Q2hhcnM6IHN0cmluZykge1xuICAgIHRoaXMuaW5kZW50ID1cbiAgICAgIHRoaXMuaW5kZW50LnNsaWNlKDAsIGluZGVudFBvcykgK1xuICAgICAgaW5kZW50Q2hhcnMgK1xuICAgICAgdGhpcy5pbmRlbnQuc2xpY2UoaW5kZW50UG9zKTtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3Rlc0luZGVudCA9XG4gICAgICAgIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UoMCwgaW5kZW50UG9zKSArXG4gICAgICAgIGluZGVudENoYXJzICtcbiAgICAgICAgdGhpcy5ub3Rlc0luZGVudC5zbGljZShpbmRlbnRQb3MpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbikge1xuICAgICAgY2hpbGQuaW5kZW50Q29udGVudChpbmRlbnRQb3MsIGluZGVudENoYXJzKTtcbiAgICB9XG4gIH1cblxuICBnZXRGaXJzdExpbmVJbmRlbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZW50O1xuICB9XG5cbiAgZ2V0QnVsbGV0KCkge1xuICAgIHJldHVybiB0aGlzLmJ1bGxldDtcbiAgfVxuXG4gIGdldFNwYWNlQWZ0ZXJCdWxsZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3BhY2VBZnRlckJ1bGxldDtcbiAgfVxuXG4gIGdldENoZWNrYm94TGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLm9wdGlvbmFsQ2hlY2tib3gubGVuZ3RoO1xuICB9XG5cbiAgcmVwbGF0ZUJ1bGxldChidWxsZXQ6IHN0cmluZykge1xuICAgIHRoaXMuYnVsbGV0ID0gYnVsbGV0O1xuICB9XG5cbiAgZ2V0UGFyZW50KCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudDtcbiAgfVxuXG4gIGFkZEJlZm9yZUFsbChsaXN0OiBMaXN0KSB7XG4gICAgdGhpcy5jaGlsZHJlbi51bnNoaWZ0KGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIGFkZEFmdGVyQWxsKGxpc3Q6IExpc3QpIHtcbiAgICB0aGlzLmNoaWxkcmVuLnB1c2gobGlzdCk7XG4gICAgbGlzdC5wYXJlbnQgPSB0aGlzO1xuICB9XG5cbiAgcmVtb3ZlQ2hpbGQobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSwgMSk7XG4gICAgbGlzdC5wYXJlbnQgPSBudWxsO1xuICB9XG5cbiAgYWRkQmVmb3JlKGJlZm9yZTogTGlzdCwgbGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoYmVmb3JlKTtcbiAgICB0aGlzLmNoaWxkcmVuLnNwbGljZShpLCAwLCBsaXN0KTtcbiAgICBsaXN0LnBhcmVudCA9IHRoaXM7XG4gIH1cblxuICBhZGRBZnRlcihiZWZvcmU6IExpc3QsIGxpc3Q6IExpc3QpIHtcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGJlZm9yZSk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSArIDEsIDAsIGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIGdldFByZXZTaWJsaW5nT2YobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgcmV0dXJuIGkgPiAwID8gdGhpcy5jaGlsZHJlbltpIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgZ2V0TmV4dFNpYmxpbmdPZihsaXN0OiBMaXN0KSB7XG4gICAgY29uc3QgaSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihsaXN0KTtcbiAgICByZXR1cm4gaSA+PSAwICYmIGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aCA/IHRoaXMuY2hpbGRyZW5baSArIDFdIDogbnVsbDtcbiAgfVxuXG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgcHJpbnQoKSB7XG4gICAgbGV0IHJlcyA9IFwiXCI7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlcyArPVxuICAgICAgICBpID09PSAwXG4gICAgICAgICAgPyB0aGlzLmluZGVudCArIHRoaXMuYnVsbGV0ICsgdGhpcy5zcGFjZUFmdGVyQnVsbGV0XG4gICAgICAgICAgOiB0aGlzLm5vdGVzSW5kZW50O1xuICAgICAgcmVzICs9IHRoaXMubGluZXNbaV07XG4gICAgICByZXMgKz0gXCJcXG5cIjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcbiAgICAgIHJlcyArPSBjaGlsZC5wcmludCgpO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBjbG9uZShuZXdSb290OiBSb290KSB7XG4gICAgY29uc3QgY2xvbmUgPSBuZXcgTGlzdChcbiAgICAgIG5ld1Jvb3QsXG4gICAgICB0aGlzLmluZGVudCxcbiAgICAgIHRoaXMuYnVsbGV0LFxuICAgICAgdGhpcy5vcHRpb25hbENoZWNrYm94LFxuICAgICAgdGhpcy5zcGFjZUFmdGVyQnVsbGV0LFxuICAgICAgXCJcIixcbiAgICAgIHRoaXMuZm9sZFJvb3RcbiAgICApO1xuICAgIGNsb25lLmlkID0gdGhpcy5pZDtcbiAgICBjbG9uZS5saW5lcyA9IHRoaXMubGluZXMuY29uY2F0KCk7XG4gICAgY2xvbmUubm90ZXNJbmRlbnQgPSB0aGlzLm5vdGVzSW5kZW50O1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbikge1xuICAgICAgY2xvbmUuYWRkQWZ0ZXJBbGwoY2hpbGQuY2xvbmUobmV3Um9vdCkpO1xuICAgIH1cblxuICAgIHJldHVybiBjbG9uZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUm9vdCB7XG4gIHByaXZhdGUgcm9vdExpc3QgPSBuZXcgTGlzdCh0aGlzLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBmYWxzZSk7XG4gIHByaXZhdGUgc2VsZWN0aW9uczogUmFuZ2VbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgc3RhcnQ6IFBvc2l0aW9uLFxuICAgIHByaXZhdGUgZW5kOiBQb3NpdGlvbixcbiAgICBzZWxlY3Rpb25zOiBSYW5nZVtdXG4gICkge1xuICAgIHRoaXMucmVwbGFjZVNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG4gIH1cblxuICBnZXRSb290TGlzdCgpIHtcbiAgICByZXR1cm4gdGhpcy5yb290TGlzdDtcbiAgfVxuXG4gIGdldFJhbmdlKCk6IFtQb3NpdGlvbiwgUG9zaXRpb25dIHtcbiAgICByZXR1cm4gW3sgLi4udGhpcy5zdGFydCB9LCB7IC4uLnRoaXMuZW5kIH1dO1xuICB9XG5cbiAgZ2V0U2VsZWN0aW9ucygpOiBSYW5nZVtdIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3Rpb25zLm1hcCgocykgPT4gKHtcbiAgICAgIGFuY2hvcjogeyAuLi5zLmFuY2hvciB9LFxuICAgICAgaGVhZDogeyAuLi5zLmhlYWQgfSxcbiAgICB9KSk7XG4gIH1cblxuICBoYXNTaW5nbGVDdXJzb3IoKSB7XG4gICAgaWYgKCF0aGlzLmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb25zWzBdO1xuXG4gICAgcmV0dXJuIChcbiAgICAgIHNlbGVjdGlvbi5hbmNob3IubGluZSA9PT0gc2VsZWN0aW9uLmhlYWQubGluZSAmJlxuICAgICAgc2VsZWN0aW9uLmFuY2hvci5jaCA9PT0gc2VsZWN0aW9uLmhlYWQuY2hcbiAgICApO1xuICB9XG5cbiAgaGFzU2luZ2xlU2VsZWN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdGlvbnMubGVuZ3RoID09PSAxO1xuICB9XG5cbiAgZ2V0U2VsZWN0aW9uKCkge1xuICAgIGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uc1t0aGlzLnNlbGVjdGlvbnMubGVuZ3RoIC0gMV07XG5cbiAgICBjb25zdCBmcm9tID1cbiAgICAgIHNlbGVjdGlvbi5hbmNob3IuY2ggPiBzZWxlY3Rpb24uaGVhZC5jaFxuICAgICAgICA/IHNlbGVjdGlvbi5oZWFkLmNoXG4gICAgICAgIDogc2VsZWN0aW9uLmFuY2hvci5jaDtcbiAgICBjb25zdCB0byA9XG4gICAgICBzZWxlY3Rpb24uYW5jaG9yLmNoID4gc2VsZWN0aW9uLmhlYWQuY2hcbiAgICAgICAgPyBzZWxlY3Rpb24uYW5jaG9yLmNoXG4gICAgICAgIDogc2VsZWN0aW9uLmhlYWQuY2g7XG5cbiAgICByZXR1cm4ge1xuICAgICAgLi4uc2VsZWN0aW9uLFxuICAgICAgZnJvbSxcbiAgICAgIHRvLFxuICAgIH07XG4gIH1cblxuICBnZXRDdXJzb3IoKSB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5zZWxlY3Rpb25zW3RoaXMuc2VsZWN0aW9ucy5sZW5ndGggLSAxXS5oZWFkIH07XG4gIH1cblxuICByZXBsYWNlQ3Vyc29yKGN1cnNvcjogUG9zaXRpb24pIHtcbiAgICB0aGlzLnNlbGVjdGlvbnMgPSBbeyBhbmNob3I6IGN1cnNvciwgaGVhZDogY3Vyc29yIH1dO1xuICB9XG5cbiAgcmVwbGFjZVNlbGVjdGlvbnMoc2VsZWN0aW9uczogUmFuZ2VbXSkge1xuICAgIGlmIChzZWxlY3Rpb25zLmxlbmd0aCA8IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGNyZWF0ZSBSb290IHdpdGhvdXQgc2VsZWN0aW9uc2ApO1xuICAgIH1cbiAgICB0aGlzLnNlbGVjdGlvbnMgPSBzZWxlY3Rpb25zO1xuICB9XG5cbiAgZ2V0TGlzdFVuZGVyQ3Vyc29yKCk6IExpc3Qge1xuICAgIHJldHVybiB0aGlzLmdldExpc3RVbmRlckxpbmUodGhpcy5nZXRDdXJzb3IoKS5saW5lKTtcbiAgfVxuXG4gIGdldExpc3RVbmRlckxpbmUobGluZTogbnVtYmVyKSB7XG4gICAgaWYgKGxpbmUgPCB0aGlzLnN0YXJ0LmxpbmUgfHwgbGluZSA+IHRoaXMuZW5kLmxpbmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0OiBMaXN0ID0gbnVsbDtcbiAgICBsZXQgaW5kZXg6IG51bWJlciA9IHRoaXMuc3RhcnQubGluZTtcblxuICAgIGNvbnN0IHZpc2l0QXJyID0gKGxsOiBMaXN0W10pID0+IHtcbiAgICAgIGZvciAoY29uc3QgbCBvZiBsbCkge1xuICAgICAgICBjb25zdCBsaXN0RnJvbUxpbmUgPSBpbmRleDtcbiAgICAgICAgY29uc3QgbGlzdFRpbGxMaW5lID0gbGlzdEZyb21MaW5lICsgbC5nZXRMaW5lQ291bnQoKSAtIDE7XG5cbiAgICAgICAgaWYgKGxpbmUgPj0gbGlzdEZyb21MaW5lICYmIGxpbmUgPD0gbGlzdFRpbGxMaW5lKSB7XG4gICAgICAgICAgcmVzdWx0ID0gbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpbmRleCA9IGxpc3RUaWxsTGluZSArIDE7XG4gICAgICAgICAgdmlzaXRBcnIobC5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHZpc2l0QXJyKHRoaXMucm9vdExpc3QuZ2V0Q2hpbGRyZW4oKSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0OiBMaXN0KTogW251bWJlciwgbnVtYmVyXSB8IG51bGwge1xuICAgIGxldCByZXN1bHQ6IFtudW1iZXIsIG51bWJlcl0gfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbGluZTogbnVtYmVyID0gdGhpcy5zdGFydC5saW5lO1xuXG4gICAgY29uc3QgdmlzaXRBcnIgPSAobGw6IExpc3RbXSkgPT4ge1xuICAgICAgZm9yIChjb25zdCBsIG9mIGxsKSB7XG4gICAgICAgIGNvbnN0IGxpc3RGcm9tTGluZSA9IGxpbmU7XG4gICAgICAgIGNvbnN0IGxpc3RUaWxsTGluZSA9IGxpc3RGcm9tTGluZSArIGwuZ2V0TGluZUNvdW50KCkgLSAxO1xuXG4gICAgICAgIGlmIChsID09PSBsaXN0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gW2xpc3RGcm9tTGluZSwgbGlzdFRpbGxMaW5lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaW5lID0gbGlzdFRpbGxMaW5lICsgMTtcbiAgICAgICAgICB2aXNpdEFycihsLmdldENoaWxkcmVuKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICB2aXNpdEFycih0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCkpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldENoaWxkcmVuKCkge1xuICAgIHJldHVybiB0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCk7XG4gIH1cblxuICBwcmludCgpIHtcbiAgICBsZXQgcmVzID0gXCJcIjtcblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpKSB7XG4gICAgICByZXMgKz0gY2hpbGQucHJpbnQoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzLnJlcGxhY2UoL1xcbiQvLCBcIlwiKTtcbiAgfVxuXG4gIGNsb25lKCkge1xuICAgIGNvbnN0IGNsb25lID0gbmV3IFJvb3QoXG4gICAgICB7IC4uLnRoaXMuc3RhcnQgfSxcbiAgICAgIHsgLi4udGhpcy5lbmQgfSxcbiAgICAgIHRoaXMuZ2V0U2VsZWN0aW9ucygpXG4gICAgKTtcbiAgICBjbG9uZS5yb290TGlzdCA9IHRoaXMucm9vdExpc3QuY2xvbmUoY2xvbmUpO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTm90aWNlLCBQbGF0Zm9ybSwgUGx1Z2luXzIsIGVkaXRvckluZm9GaWVsZCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBTdGF0ZUVmZmVjdCwgU3RhdGVGaWVsZCB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgRGVjb3JhdGlvbiwgRGVjb3JhdGlvblNldCwgRWRpdG9yVmlldyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL015RWRpdG9yXCI7XG5pbXBvcnQgeyBNb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb25PcGVyYXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb25PcGVyYXRpb25cIjtcbmltcG9ydCB7IExpc3QsIFJvb3QsIGNtcFBvcyB9IGZyb20gXCIuLi9yb290XCI7XG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQYXJzZXJTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BhcnNlclNlcnZpY2VcIjtcbmltcG9ydCB7IFBlcmZvcm1PcGVyYXRpb25TZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BlcmZvcm1PcGVyYXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBTZXR0aW5nc1NlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NTZXJ2aWNlXCI7XG5cbmV4cG9ydCBjbGFzcyBEcmFnQW5kRHJvcEZlYXR1cmUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgcHJpdmF0ZSBkcm9wWm9uZTogSFRNTERpdkVsZW1lbnQ7XG4gIHByaXZhdGUgc3RhdGU6IERyYWdBbmREcm9wU3RhdGUgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luXzIsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NTZXJ2aWNlLFxuICAgIHByaXZhdGUgb2Jpc2lkaWFuOiBPYnNpZGlhblNlcnZpY2UsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlclNlcnZpY2UsXG4gICAgcHJpdmF0ZSBwZXJmb3JtT3BlcmF0aW9uOiBQZXJmb3JtT3BlcmF0aW9uU2VydmljZVxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihkbmRTdGF0ZUZpZWxkKTtcbiAgICB0aGlzLmVuYWJsZUZlYXR1cmVUb2dnbGUoKTtcbiAgICB0aGlzLmNyZWF0ZURyb3Bab25lKCk7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLnJlbW92ZURyb3Bab25lKCk7XG4gICAgdGhpcy5kaXNhYmxlRmVhdHVyZVRvZ2dsZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBlbmFibGVGZWF0dXJlVG9nZ2xlKCkge1xuICAgIHRoaXMuc2V0dGluZ3Mub25DaGFuZ2UoXCJkbmRFeHBlcmltZW50XCIsIHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UpO1xuICAgIHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UodGhpcy5zZXR0aW5ncy5kbmRFeHBlcmltZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgZGlzYWJsZUZlYXR1cmVUb2dnbGUoKSB7XG4gICAgdGhpcy5zZXR0aW5ncy5yZW1vdmVDYWxsYmFjayhcImRuZEV4cGVyaW1lbnRcIiwgdGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSk7XG4gICAgdGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZShmYWxzZSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURyb3Bab25lKCkge1xuICAgIHRoaXMuZHJvcFpvbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuZHJvcFpvbmUuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1kcm9wLXpvbmVcIik7XG4gICAgdGhpcy5kcm9wWm9uZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmRyb3Bab25lKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlRHJvcFpvbmUoKSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0aGlzLmRyb3Bab25lKTtcbiAgICB0aGlzLmRyb3Bab25lID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLmhhbmRsZU1vdXNlRG93biwge1xuICAgICAgY2FwdHVyZTogdHJ1ZSxcbiAgICB9KTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIHRoaXMuaGFuZGxlTW91c2VNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCB0aGlzLmhhbmRsZU1vdXNlVXApO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuaGFuZGxlS2V5RG93bik7XG4gIH1cblxuICBwcml2YXRlIHJlbW92ZUV2ZW50TGlzdGVuZXJzKCkge1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgdGhpcy5oYW5kbGVNb3VzZURvd24sIHtcbiAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgfSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLmhhbmRsZU1vdXNlTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5oYW5kbGVNb3VzZVVwKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmhhbmRsZUtleURvd24pO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVTZXR0aW5nc0NoYW5nZShkbmRFeHBlcmltZW50OiBib29sZWFuKSB7XG4gICAgaWYgKCFpc0ZlYXR1cmVTdXBwb3J0ZWQoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChkbmRFeHBlcmltZW50KSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoXCJvdXRsaW5lci1wbHVnaW4tZG5kXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoXCJvdXRsaW5lci1wbHVnaW4tZG5kXCIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBpZiAoXG4gICAgICAhaXNGZWF0dXJlU3VwcG9ydGVkKCkgfHxcbiAgICAgICF0aGlzLnNldHRpbmdzLmRuZEV4cGVyaW1lbnQgfHxcbiAgICAgICFpc0NsaWNrT25CdWxsZXQoZSlcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB2aWV3ID0gZ2V0RWRpdG9yVmlld0Zyb21IVE1MRWxlbWVudChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCk7XG4gICAgaWYgKCF2aWV3KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICB0aGlzLnN0YXJ0RHJhZ2dpbmcoZS54LCBlLnksIHZpZXcpO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlTW91c2VNb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBpZiAodGhpcy5zdGF0ZSkge1xuICAgICAgdGhpcy5kZXRlY3RBbmREcmF3RHJvcFpvbmUoZS54LCBlLnkpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZU1vdXNlVXAgPSAoKSA9PiB7XG4gICAgaWYgKHRoaXMuc3RhdGUpIHtcbiAgICAgIHRoaXMuc3RvcERyYWdnaW5nKCk7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlS2V5RG93biA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgaWYgKHRoaXMuc3RhdGUgJiYgZS5jb2RlID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICB0aGlzLmNhbmNlbERyYWdnaW5nKCk7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgc3RhcnREcmFnZ2luZyh4OiBudW1iZXIsIHk6IG51bWJlciwgdmlldzogRWRpdG9yVmlldykge1xuICAgIGNvbnN0IGVkaXRvciA9IG5ldyBNeUVkaXRvcih2aWV3LnN0YXRlLmZpZWxkKGVkaXRvckluZm9GaWVsZCkuZWRpdG9yKTtcbiAgICBjb25zdCBwb3MgPSBlZGl0b3Iub2Zmc2V0VG9Qb3Modmlldy5wb3NBdENvb3Jkcyh7IHgsIHkgfSkpO1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IsIHBvcyk7XG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShwb3MubGluZSk7XG4gICAgY29uc3Qgc3RhdGUgPSBuZXcgRHJhZ0FuZERyb3BTdGF0ZSh2aWV3LCBlZGl0b3IsIHJvb3QsIGxpc3QpO1xuXG4gICAgaWYgKCFzdGF0ZS5oYXNEcm9wVmFyaWFudHMoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcbiAgICB0aGlzLmhpZ2hsaWdodERyYWdnaW5nTGluZXMoKTtcbiAgICB0aGlzLmRldGVjdEFuZERyYXdEcm9wWm9uZSh4LCB5KTtcbiAgfVxuXG4gIHByaXZhdGUgZGV0ZWN0QW5kRHJhd0Ryb3Bab25lKHg6IG51bWJlciwgeTogbnVtYmVyKSB7XG4gICAgdGhpcy5zdGF0ZS5jYWxjdWxhdGVOZWFyZXN0RHJvcFZhcmlhbnQoeCwgeSk7XG4gICAgdGhpcy5kcmF3RHJvcFpvbmUoKTtcbiAgfVxuXG4gIHByaXZhdGUgY2FuY2VsRHJhZ2dpbmcoKSB7XG4gICAgdGhpcy5zdGF0ZS5kcm9wVmFyaWFudCA9IG51bGw7XG4gICAgdGhpcy5zdG9wRHJhZ2dpbmcoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RvcERyYWdnaW5nKCkge1xuICAgIHRoaXMudW5oaWdodGxpZ2h0RHJhZ2dpbmdMaW5lcygpO1xuICAgIHRoaXMuaGlkZURyb3Bab25lKCk7XG4gICAgdGhpcy5hcHBseUNoYW5nZXMoKTtcbiAgICB0aGlzLnN0YXRlID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHlDaGFuZ2VzKCkge1xuICAgIGlmICghdGhpcy5zdGF0ZS5kcm9wVmFyaWFudCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHsgc3RhdGUgfSA9IHRoaXM7XG4gICAgY29uc3QgeyBkcm9wVmFyaWFudCwgZWRpdG9yLCByb290LCBsaXN0IH0gPSBzdGF0ZTtcblxuICAgIGNvbnN0IG5ld1Jvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IsIHJvb3QuZ2V0UmFuZ2UoKVswXSk7XG4gICAgaWYgKCFpc1NhbWVSb290cyhyb290LCBuZXdSb290KSkge1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgYFRoZSBpdGVtIGNhbm5vdCBiZSBtb3ZlZC4gVGhlIHBhZ2UgY29udGVudCBjaGFuZ2VkIGR1cmluZyB0aGUgbW92ZS5gLFxuICAgICAgICA1MDAwXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucGVyZm9ybU9wZXJhdGlvbi5ldmFsT3BlcmF0aW9uKFxuICAgICAgcm9vdCxcbiAgICAgIG5ldyBNb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb25PcGVyYXRpb24oXG4gICAgICAgIHJvb3QsXG4gICAgICAgIGxpc3QsXG4gICAgICAgIGRyb3BWYXJpYW50LnBsYWNlVG9Nb3ZlLFxuICAgICAgICBkcm9wVmFyaWFudC53aGVyZVRvTW92ZSxcbiAgICAgICAgdGhpcy5vYmlzaWRpYW4uZ2V0RGVmYXVsdEluZGVudENoYXJzKClcbiAgICAgICksXG4gICAgICBlZGl0b3JcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBoaWdobGlnaHREcmFnZ2luZ0xpbmVzKCkge1xuICAgIGNvbnN0IHsgc3RhdGUgfSA9IHRoaXM7XG4gICAgY29uc3QgeyBsaXN0LCBlZGl0b3IsIHZpZXcgfSA9IHN0YXRlO1xuXG4gICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICBjb25zdCBmcm9tTGluZSA9IGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICBjb25zdCB0aWxsTGluZSA9IGxpc3QuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkubGluZTtcbiAgICBmb3IgKGxldCBpID0gZnJvbUxpbmU7IGkgPD0gdGlsbExpbmU7IGkrKykge1xuICAgICAgbGluZXMucHVzaChlZGl0b3IucG9zVG9PZmZzZXQoeyBsaW5lOiBpLCBjaDogMCB9KSk7XG4gICAgfVxuICAgIHZpZXcuZGlzcGF0Y2goe1xuICAgICAgZWZmZWN0czogW2RuZFN0YXJ0ZWQub2YobGluZXMpXSxcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1kcmFnZ2luZ1wiKTtcbiAgfVxuXG4gIHByaXZhdGUgdW5oaWdodGxpZ2h0RHJhZ2dpbmdMaW5lcygpIHtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoXCJvdXRsaW5lci1wbHVnaW4tZHJhZ2dpbmdcIik7XG5cbiAgICB0aGlzLnN0YXRlLnZpZXcuZGlzcGF0Y2goe1xuICAgICAgZWZmZWN0czogW2RuZEVuZGVkLm9mKCldLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmF3RHJvcFpvbmUoKSB7XG4gICAgY29uc3QgeyBzdGF0ZSB9ID0gdGhpcztcbiAgICBjb25zdCB7IHZpZXcsIGVkaXRvciwgbGlzdCwgZHJvcFZhcmlhbnQgfSA9IHN0YXRlO1xuXG4gICAgY29uc3Qgd2lkdGggPSBNYXRoLnJvdW5kKFxuICAgICAgdmlldy5jb250ZW50RE9NLm9mZnNldFdpZHRoIC1cbiAgICAgICAgKGRyb3BWYXJpYW50LmxlZnQgLVxuICAgICAgICAgIHZpZXcuY29vcmRzQXRQb3MoXG4gICAgICAgICAgICBlZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgICAgICAgICBsaW5lOiBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICAgICAgICAgIGNoOiAwLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApLmxlZnQpXG4gICAgKTtcblxuICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICB0aGlzLmRyb3Bab25lLnN0eWxlLnRvcCA9IGRyb3BWYXJpYW50LnRvcCArIFwicHhcIjtcbiAgICB0aGlzLmRyb3Bab25lLnN0eWxlLmxlZnQgPSBkcm9wVmFyaWFudC5sZWZ0ICsgXCJweFwiO1xuICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUud2lkdGggPSB3aWR0aCArIFwicHhcIjtcblxuICAgIGlmIChcbiAgICAgIGRyb3BWYXJpYW50LndoZXJlVG9Nb3ZlID09PSBcImJlZm9yZVwiICYmXG4gICAgICAhdGhpcy5kcm9wWm9uZS5jbGFzc0xpc3QuY29udGFpbnMoXCJvdXRsaW5lci1wbHVnaW4tZHJvcC16b25lLWJlZm9yZVwiKVxuICAgICkge1xuICAgICAgdGhpcy5kcm9wWm9uZS5jbGFzc0xpc3QucmVtb3ZlKFwib3V0bGluZXItcGx1Z2luLWRyb3Atem9uZS1hZnRlclwiKTtcbiAgICAgIHRoaXMuZHJvcFpvbmUuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1kcm9wLXpvbmUtYmVmb3JlXCIpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAoZHJvcFZhcmlhbnQud2hlcmVUb01vdmUgPT09IFwiYWZ0ZXJcIiB8fFxuICAgICAgICBkcm9wVmFyaWFudC53aGVyZVRvTW92ZSA9PT0gXCJpbnNpZGVcIikgJiZcbiAgICAgICF0aGlzLmRyb3Bab25lLmNsYXNzTGlzdC5jb250YWlucyhcIm91dGxpbmVyLXBsdWdpbi1kcm9wLXpvbmUtYWZ0ZXJcIilcbiAgICApIHtcbiAgICAgIHRoaXMuZHJvcFpvbmUuY2xhc3NMaXN0LnJlbW92ZShcIm91dGxpbmVyLXBsdWdpbi1kcm9wLXpvbmUtYmVmb3JlXCIpO1xuICAgICAgdGhpcy5kcm9wWm9uZS5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWRyb3Atem9uZS1hZnRlclwiKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGhpZGVEcm9wWm9uZSgpIHtcbiAgICB0aGlzLmRyb3Bab25lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgfVxufVxuXG5pbnRlcmZhY2UgRHJvcFZhcmlhbnQge1xuICBsaW5lOiBudW1iZXI7XG4gIGxldmVsOiBudW1iZXI7XG4gIGxlZnQ6IG51bWJlcjtcbiAgdG9wOiBudW1iZXI7XG4gIHBsYWNlVG9Nb3ZlOiBMaXN0O1xuICB3aGVyZVRvTW92ZTogXCJhZnRlclwiIHwgXCJiZWZvcmVcIiB8IFwiaW5zaWRlXCI7XG59XG5cbmNsYXNzIERyYWdBbmREcm9wU3RhdGUge1xuICBwcml2YXRlIGRyb3BWYXJpYW50czogTWFwPHN0cmluZywgRHJvcFZhcmlhbnQ+ID0gbmV3IE1hcCgpO1xuICBwdWJsaWMgZHJvcFZhcmlhbnQ6IERyb3BWYXJpYW50ID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgdmlldzogRWRpdG9yVmlldyxcbiAgICBwdWJsaWMgcmVhZG9ubHkgZWRpdG9yOiBNeUVkaXRvcixcbiAgICBwdWJsaWMgcmVhZG9ubHkgcm9vdDogUm9vdCxcbiAgICBwdWJsaWMgcmVhZG9ubHkgbGlzdDogTGlzdFxuICApIHtcbiAgICB0aGlzLmNvbGxlY3REcm9wVmFyaWFudHMoKTtcbiAgfVxuXG4gIGdldERyb3BWYXJpYW50cygpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmRyb3BWYXJpYW50cy52YWx1ZXMoKSk7XG4gIH1cblxuICBoYXNEcm9wVmFyaWFudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuZHJvcFZhcmlhbnRzLnNpemUgPiAwO1xuICB9XG5cbiAgY2FsY3VsYXRlTmVhcmVzdERyb3BWYXJpYW50KHg6IG51bWJlciwgeTogbnVtYmVyKSB7XG4gICAgY29uc3QgeyB2aWV3LCBlZGl0b3IgfSA9IHRoaXM7XG5cbiAgICB0aGlzLmRyb3BWYXJpYW50ID0gdGhpcy5nZXREcm9wVmFyaWFudHMoKVxuICAgICAgLm1hcCgodikgPT4ge1xuICAgICAgICBjb25zdCB7IHBsYWNlVG9Nb3ZlIH0gPSB2O1xuXG4gICAgICAgIHN3aXRjaCAodi53aGVyZVRvTW92ZSkge1xuICAgICAgICAgIGNhc2UgXCJiZWZvcmVcIjpcbiAgICAgICAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgICAgICAgIHYubGVmdCA9IE1hdGgucm91bmQoXG4gICAgICAgICAgICAgIHZpZXcuY29vcmRzQXRQb3MoXG4gICAgICAgICAgICAgICAgZWRpdG9yLnBvc1RvT2Zmc2V0KHtcbiAgICAgICAgICAgICAgICAgIGxpbmU6IHBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICAgICAgICAgICAgICBjaDogcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICkubGVmdFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSBcImluc2lkZVwiOlxuICAgICAgICAgICAgdi5sZWZ0ID0gTWF0aC5yb3VuZChcbiAgICAgICAgICAgICAgdmlldy5jb29yZHNBdFBvcyhcbiAgICAgICAgICAgICAgICBlZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgICAgICAgICAgICAgbGluZTogcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSxcbiAgICAgICAgICAgICAgICAgIGNoOiBwbGFjZVRvTW92ZS5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgKS5sZWZ0ICtcbiAgICAgICAgICAgICAgICB2aWV3LmRlZmF1bHRDaGFyYWN0ZXJXaWR0aCAqIDJcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAodi53aGVyZVRvTW92ZSkge1xuICAgICAgICAgIGNhc2UgXCJiZWZvcmVcIjpcbiAgICAgICAgICAgIHYudG9wID0gTWF0aC5yb3VuZChcbiAgICAgICAgICAgICAgdmlldy5jb29yZHNBdFBvcyhcbiAgICAgICAgICAgICAgICBlZGl0b3IucG9zVG9PZmZzZXQocGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkpXG4gICAgICAgICAgICAgICkudG9wXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgICAgICBjYXNlIFwiaW5zaWRlXCI6XG4gICAgICAgICAgICB2LnRvcCA9IE1hdGgucm91bmQoXG4gICAgICAgICAgICAgIHZpZXcuY29vcmRzQXRQb3MoXG4gICAgICAgICAgICAgICAgZWRpdG9yLnBvc1RvT2Zmc2V0KHBsYWNlVG9Nb3ZlLmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpKVxuICAgICAgICAgICAgICApLnRvcCArIHZpZXcuZGVmYXVsdExpbmVIZWlnaHRcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2O1xuICAgICAgfSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGlmIChhLnRvcCA9PT0gYi50b3ApIHtcbiAgICAgICAgICByZXR1cm4gTWF0aC5hYnMoeCAtIGEubGVmdCkgLSBNYXRoLmFicyh4IC0gYi5sZWZ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBNYXRoLmFicyh5IC0gYS50b3ApIC0gTWF0aC5hYnMoeSAtIGIudG9wKTtcbiAgICAgIH0pXG4gICAgICAuZmlyc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkRHJvcFZhcmlhbnQodjogRHJvcFZhcmlhbnQpIHtcbiAgICB0aGlzLmRyb3BWYXJpYW50cy5zZXQoYCR7di5saW5lfSAke3YubGV2ZWx9YCwgdik7XG4gIH1cblxuICBwcml2YXRlIGNvbGxlY3REcm9wVmFyaWFudHMoKSB7XG4gICAgY29uc3QgdmlzaXQgPSAobGlzdHM6IExpc3RbXSkgPT4ge1xuICAgICAgZm9yIChjb25zdCBwbGFjZVRvTW92ZSBvZiBsaXN0cykge1xuICAgICAgICBjb25zdCBsaW5lQmVmb3JlID0gcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICAgICAgY29uc3QgbGluZUFmdGVyID0gcGxhY2VUb01vdmUuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkubGluZSArIDE7XG5cbiAgICAgICAgY29uc3QgbGV2ZWwgPSBwbGFjZVRvTW92ZS5nZXRMZXZlbCgpO1xuXG4gICAgICAgIHRoaXMuYWRkRHJvcFZhcmlhbnQoe1xuICAgICAgICAgIGxpbmU6IGxpbmVCZWZvcmUsXG4gICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgd2hlcmVUb01vdmU6IFwiYmVmb3JlXCIsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFkZERyb3BWYXJpYW50KHtcbiAgICAgICAgICBsaW5lOiBsaW5lQWZ0ZXIsXG4gICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgd2hlcmVUb01vdmU6IFwiYWZ0ZXJcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHBsYWNlVG9Nb3ZlLmlzRW1wdHkoKSkge1xuICAgICAgICAgIHRoaXMuYWRkRHJvcFZhcmlhbnQoe1xuICAgICAgICAgICAgbGluZTogbGluZUFmdGVyLFxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsICsgMSxcbiAgICAgICAgICAgIGxlZnQ6IDAsXG4gICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICBwbGFjZVRvTW92ZSxcbiAgICAgICAgICAgIHdoZXJlVG9Nb3ZlOiBcImluc2lkZVwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBsYWNlVG9Nb3ZlICE9PSB0aGlzLmxpc3QpIHtcbiAgICAgICAgICB2aXNpdChwbGFjZVRvTW92ZS5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICB2aXNpdCh0aGlzLnJvb3QuZ2V0Q2hpbGRyZW4oKSk7XG4gIH1cbn1cblxuY29uc3QgZG5kU3RhcnRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTxudW1iZXJbXT4oe1xuICBtYXA6IChsaW5lcywgY2hhbmdlKSA9PiBsaW5lcy5tYXAoKGwpID0+IGNoYW5nZS5tYXBQb3MobCkpLFxufSk7XG5cbmNvbnN0IGRuZEVuZGVkID0gU3RhdGVFZmZlY3QuZGVmaW5lPHZvaWQ+KCk7XG5cbmNvbnN0IGRyYWdnaW5nTGluZURlY29yYXRpb24gPSBEZWNvcmF0aW9uLmxpbmUoe1xuICBjbGFzczogXCJvdXRsaW5lci1wbHVnaW4tZHJhZ2dpbmctbGluZVwiLFxufSk7XG5cbmNvbnN0IGRuZFN0YXRlRmllbGQgPSBTdGF0ZUZpZWxkLmRlZmluZTxEZWNvcmF0aW9uU2V0Pih7XG4gIGNyZWF0ZTogKCkgPT4gRGVjb3JhdGlvbi5ub25lLFxuXG4gIHVwZGF0ZTogKGRuZFN0YXRlLCB0cikgPT4ge1xuICAgIGRuZFN0YXRlID0gZG5kU3RhdGUubWFwKHRyLmNoYW5nZXMpO1xuXG4gICAgZm9yIChjb25zdCBlIG9mIHRyLmVmZmVjdHMpIHtcbiAgICAgIGlmIChlLmlzKGRuZFN0YXJ0ZWQpKSB7XG4gICAgICAgIGRuZFN0YXRlID0gZG5kU3RhdGUudXBkYXRlKHtcbiAgICAgICAgICBhZGQ6IGUudmFsdWUubWFwKChsKSA9PiBkcmFnZ2luZ0xpbmVEZWNvcmF0aW9uLnJhbmdlKGwsIGwpKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChlLmlzKGRuZEVuZGVkKSkge1xuICAgICAgICBkbmRTdGF0ZSA9IERlY29yYXRpb24ubm9uZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZG5kU3RhdGU7XG4gIH0sXG5cbiAgcHJvdmlkZTogKGYpID0+IEVkaXRvclZpZXcuZGVjb3JhdGlvbnMuZnJvbShmKSxcbn0pO1xuXG5mdW5jdGlvbiBnZXRFZGl0b3JWaWV3RnJvbUhUTUxFbGVtZW50KGU6IEhUTUxFbGVtZW50KSB7XG4gIHdoaWxlIChlICYmICFlLmNsYXNzTGlzdC5jb250YWlucyhcImNtLWVkaXRvclwiKSkge1xuICAgIGUgPSBlLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICBpZiAoIWUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBFZGl0b3JWaWV3LmZpbmRGcm9tRE9NKGUpO1xufVxuXG5mdW5jdGlvbiBpc0NsaWNrT25CdWxsZXQoZTogTW91c2VFdmVudCkge1xuICBsZXQgZWwgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcblxuICB3aGlsZSAoZWwpIHtcbiAgICBpZiAoXG4gICAgICBlbC5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1mb3JtYXR0aW5nLWxpc3RcIikgfHxcbiAgICAgIGVsLmNsYXNzTGlzdC5jb250YWlucyhcImNtLWZvbGQtaW5kaWNhdG9yXCIpXG4gICAgKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGlzU2FtZVJvb3RzKGE6IFJvb3QsIGI6IFJvb3QpIHtcbiAgY29uc3QgYVJhbmdlID0gYS5nZXRSYW5nZSgpO1xuICBjb25zdCBiUmFuZ2UgPSBiLmdldFJhbmdlKCk7XG5cbiAgaWYgKFxuICAgIGNtcFBvcyhhUmFuZ2VbMF0sIGJSYW5nZVswXSkgIT09IDAgfHxcbiAgICBjbXBQb3MoYVJhbmdlWzFdLCBiUmFuZ2VbMV0pICE9PSAwXG4gICkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBhLnByaW50KCkgPT09IGIucHJpbnQoKTtcbn1cblxuZnVuY3Rpb24gaXNGZWF0dXJlU3VwcG9ydGVkKCkge1xuICByZXR1cm4gUGxhdGZvcm0uaXNEZXNrdG9wO1xufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgRW5zdXJlQ3Vyc29ySW5MaXN0Q29udGVudE9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY29udGVudFN0YXJ0ID0gbGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnRBZnRlckNoZWNrYm94KCk7XG4gICAgY29uc3QgbGluZVByZWZpeCA9XG4gICAgICBjb250ZW50U3RhcnQubGluZSA9PT0gY3Vyc29yLmxpbmVcbiAgICAgICAgPyBjb250ZW50U3RhcnQuY2hcbiAgICAgICAgOiBsaXN0LmdldE5vdGVzSW5kZW50KCkubGVuZ3RoO1xuXG4gICAgaWYgKGN1cnNvci5jaCA8IGxpbmVQcmVmaXgpIHtcbiAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgICBsaW5lOiBjdXJzb3IubGluZSxcbiAgICAgICAgY2g6IGxpbmVQcmVmaXgsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIEVuc3VyZUN1cnNvcklzSW5VbmZvbGRlZExpbmVPcGVyYXRpb24gaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgaWYgKCFsaXN0LmlzRm9sZGVkKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkUm9vdCA9IGxpc3QuZ2V0VG9wRm9sZFJvb3QoKTtcbiAgICBjb25zdCBmaXJzdExpbmVFbmQgPSBmb2xkUm9vdC5nZXRMaW5lc0luZm8oKVswXS50bztcblxuICAgIGlmIChjdXJzb3IubGluZSA+IGZpcnN0TGluZUVuZC5saW5lKSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGZpcnN0TGluZUVuZCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW5fMiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBFZGl0b3JTdGF0ZSwgVHJhbnNhY3Rpb24gfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vTXlFZGl0b3JcIjtcbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi4vZmVhdHVyZXMvRmVhdHVyZVwiO1xuaW1wb3J0IHsgRW5zdXJlQ3Vyc29ySW5MaXN0Q29udGVudE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0Vuc3VyZUN1cnNvckluTGlzdENvbnRlbnRPcGVyYXRpb25cIjtcbmltcG9ydCB7IEVuc3VyZUN1cnNvcklzSW5VbmZvbGRlZExpbmVPcGVyYXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9FbnN1cmVDdXJzb3JJc0luVW5mb2xkZWRMaW5lT3BlcmF0aW9uXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQZXJmb3JtT3BlcmF0aW9uU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QZXJmb3JtT3BlcmF0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5leHBvcnQgY2xhc3MgRW5zdXJlQ3Vyc29ySW5MaXN0Q29udGVudEZlYXR1cmUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbl8yLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzU2VydmljZSxcbiAgICBwcml2YXRlIG9ic2lkaWFuOiBPYnNpZGlhblNlcnZpY2UsXG4gICAgcHJpdmF0ZSBwZXJmb3JtT3BlcmF0aW9uOiBQZXJmb3JtT3BlcmF0aW9uU2VydmljZVxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIEVkaXRvclN0YXRlLnRyYW5zYWN0aW9uRXh0ZW5kZXIub2YodGhpcy50cmFuc2FjdGlvbkV4dGVuZGVyKVxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgdHJhbnNhY3Rpb25FeHRlbmRlciA9ICh0cjogVHJhbnNhY3Rpb24pOiBudWxsID0+IHtcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5zdGlja0N1cnNvciA9PSBcIm5ldmVyXCIgfHwgIXRyLnNlbGVjdGlvbikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZWRpdG9yID0gdGhpcy5vYnNpZGlhbi5nZXRFZGl0b3JGcm9tU3RhdGUodHIuc3RhcnRTdGF0ZSk7XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuaGFuZGxlQ3Vyc29yQWN0aXZpdHkoZWRpdG9yKTtcbiAgICB9LCAwKTtcblxuICAgIHJldHVybiBudWxsO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlQ3Vyc29yQWN0aXZpdHkgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHRoaXMucGVyZm9ybU9wZXJhdGlvbi5wZXJmb3JtT3BlcmF0aW9uKFxuICAgICAgKHJvb3QpID0+IG5ldyBFbnN1cmVDdXJzb3JJc0luVW5mb2xkZWRMaW5lT3BlcmF0aW9uKHJvb3QpLFxuICAgICAgZWRpdG9yXG4gICAgKTtcblxuICAgIHRoaXMucGVyZm9ybU9wZXJhdGlvbi5wZXJmb3JtT3BlcmF0aW9uKFxuICAgICAgKHJvb3QpID0+IG5ldyBFbnN1cmVDdXJzb3JJbkxpc3RDb250ZW50T3BlcmF0aW9uKHJvb3QpLFxuICAgICAgZWRpdG9yXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdC9yZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzXCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlTGVmdE9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXJlbnQuZ2V0UGFyZW50KCk7XG5cbiAgICBpZiAoIWdyYW5kUGFyZW50KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVCZWZvcmUgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgaW5kZW50Um1Gcm9tID0gcGFyZW50LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aDtcbiAgICBjb25zdCBpbmRlbnRSbVRpbGwgPSBsaXN0LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aDtcblxuICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICBncmFuZFBhcmVudC5hZGRBZnRlcihwYXJlbnQsIGxpc3QpO1xuICAgIGxpc3QudW5pbmRlbnRDb250ZW50KGluZGVudFJtRnJvbSwgaW5kZW50Um1UaWxsKTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVBZnRlciA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcbiAgICBjb25zdCBsaW5lRGlmZiA9IGxpc3RTdGFydExpbmVBZnRlciAtIGxpc3RTdGFydExpbmVCZWZvcmU7XG4gICAgY29uc3QgY2hEaWZmID0gaW5kZW50Um1UaWxsIC0gaW5kZW50Um1Gcm9tO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2ggLSBjaERpZmYsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3gobGluZTogc3RyaW5nKSB7XG4gIHJldHVybiBsaW5lID09PSBcIlwiIHx8IGxpbmUgPT09IFwiWyBdIFwiO1xufVxuIiwiaW1wb3J0IHsgTW92ZUxlZnRPcGVyYXRpb24gfSBmcm9tIFwiLi9Nb3ZlTGVmdE9wZXJhdGlvblwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3ggfSBmcm9tIFwiLi4vdXRpbHMvaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3hcIjtcblxuZXhwb3J0IGNsYXNzIE91dGRlbnRJZkxpbmVJc0VtcHR5T3BlcmF0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBtb3ZlTGVmdE9wOiBNb3ZlTGVmdE9wZXJhdGlvbjtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHtcbiAgICB0aGlzLm1vdmVMZWZ0T3AgPSBuZXcgTW92ZUxlZnRPcGVyYXRpb24ocm9vdCk7XG4gIH1cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubW92ZUxlZnRPcC5zaG91bGRTdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5tb3ZlTGVmdE9wLnNob3VsZFVwZGF0ZSgpO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXMoKTtcblxuICAgIGlmIChcbiAgICAgIGxpbmVzLmxlbmd0aCA+IDEgfHxcbiAgICAgICFpc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveChsaW5lc1swXSkgfHxcbiAgICAgIGxpc3QuZ2V0TGV2ZWwoKSA9PT0gMVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubW92ZUxlZnRPcC5wZXJmb3JtKCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbl8yIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IFByZWMgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL015RWRpdG9yXCI7XG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4uL2ZlYXR1cmVzL0ZlYXR1cmVcIjtcbmltcG9ydCB7IE91dGRlbnRJZkxpbmVJc0VtcHR5T3BlcmF0aW9uIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvT3V0ZGVudElmTGluZUlzRW1wdHlPcGVyYXRpb25cIjtcbmltcG9ydCB7IElNRVNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FU2VydmljZVwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2VydmljZVwiO1xuaW1wb3J0IHsgUGVyZm9ybU9wZXJhdGlvblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcIjtcbmltcG9ydCB7IFNldHRpbmdzU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1NlcnZpY2VcIjtcblxuZXhwb3J0IGNsYXNzIEVudGVyT3V0ZGVudElmTGluZUlzRW1wdHlGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW5fMixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UsXG4gICAgcHJpdmF0ZSBpbWU6IElNRVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBvYnNpZGlhbjogT2JzaWRpYW5TZXJ2aWNlLFxuICAgIHByaXZhdGUgcGVyZm9ybU9wZXJhdGlvbjogUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBQcmVjLmhpZ2hlc3QoXG4gICAgICAgIGtleW1hcC5vZihbXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiBcIkVudGVyXCIsXG4gICAgICAgICAgICBydW46IHRoaXMub2JzaWRpYW4uY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0pXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5iZXR0ZXJFbnRlciAmJiAhdGhpcy5pbWUuaXNJTUVPcGVuZWQoKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMucGVyZm9ybU9wZXJhdGlvbi5wZXJmb3JtT3BlcmF0aW9uKFxuICAgICAgKHJvb3QpID0+IG5ldyBPdXRkZW50SWZMaW5lSXNFbXB0eU9wZXJhdGlvbihyb290KSxcbiAgICAgIGVkaXRvclxuICAgICk7XG4gIH07XG59XG4iLCJleHBvcnQgY29uc3QgY2hlY2tib3hSZSA9IGBcXFxcW1teXFxcXFtcXFxcXV1cXFxcXVsgXFx0XWA7XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgTGlzdCwgUG9zaXRpb24sIFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290L3JlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHNcIjtcbmltcG9ydCB7IGNoZWNrYm94UmUgfSBmcm9tIFwiLi4vdXRpbHMvY2hlY2tib3hSZVwiO1xuaW1wb3J0IHsgaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3ggfSBmcm9tIFwiLi4vdXRpbHMvaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3hcIjtcblxuZXhwb3J0IGludGVyZmFjZSBHZXRab29tUmFuZ2Uge1xuICBnZXRab29tUmFuZ2UoKTogeyBmcm9tOiBQb3NpdGlvbjsgdG86IFBvc2l0aW9uIH0gfCBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgQ3JlYXRlTmV3SXRlbU9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcm9vdDogUm9vdCxcbiAgICBwcml2YXRlIGRlZmF1bHRJbmRlbnRDaGFyczogc3RyaW5nLFxuICAgIHByaXZhdGUgZ2V0Wm9vbVJhbmdlOiBHZXRab29tUmFuZ2VcbiAgKSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gcm9vdC5nZXRTZWxlY3Rpb24oKTtcbiAgICBpZiAoIXNlbGVjdGlvbiB8fCBzZWxlY3Rpb24uYW5jaG9yLmxpbmUgIT09IHNlbGVjdGlvbi5oZWFkLmxpbmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBpZiAobGluZXMubGVuZ3RoID09PSAxICYmIGlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94KGxpbmVzWzBdLnRleHQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lVW5kZXJDdXJzb3IgPSBsaW5lcy5maW5kKChsKSA9PiBsLmZyb20ubGluZSA9PT0gY3Vyc29yLmxpbmUpO1xuXG4gICAgaWYgKGN1cnNvci5jaCA8IGxpbmVVbmRlckN1cnNvci5mcm9tLmNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyBvbGRMaW5lcywgbmV3TGluZXMgfSA9IGxpbmVzLnJlZHVjZShcbiAgICAgIChhY2MsIGxpbmUpID0+IHtcbiAgICAgICAgaWYgKGN1cnNvci5saW5lID4gbGluZS5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBhY2Mub2xkTGluZXMucHVzaChsaW5lLnRleHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci5saW5lID09PSBsaW5lLmZyb20ubGluZSkge1xuICAgICAgICAgIGNvbnN0IGxlZnQgPSBsaW5lLnRleHQuc2xpY2UoMCwgc2VsZWN0aW9uLmZyb20gLSBsaW5lLmZyb20uY2gpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gbGluZS50ZXh0LnNsaWNlKHNlbGVjdGlvbi50byAtIGxpbmUuZnJvbS5jaCk7XG4gICAgICAgICAgYWNjLm9sZExpbmVzLnB1c2gobGVmdCk7XG4gICAgICAgICAgYWNjLm5ld0xpbmVzLnB1c2gocmlnaHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci5saW5lIDwgbGluZS5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBhY2MubmV3TGluZXMucHVzaChsaW5lLnRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG9sZExpbmVzOiBbXSxcbiAgICAgICAgbmV3TGluZXM6IFtdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBjb2RlQmxvY2tCYWN0aWNrcyA9IG9sZExpbmVzLmpvaW4oXCJcXG5cIikuc3BsaXQoXCJgYGBcIikubGVuZ3RoIC0gMTtcbiAgICBjb25zdCBpc0luc2lkZUNvZGVibG9jayA9XG4gICAgICBjb2RlQmxvY2tCYWN0aWNrcyA+IDAgJiYgY29kZUJsb2NrQmFjdGlja3MgJSAyICE9PSAwO1xuXG4gICAgaWYgKGlzSW5zaWRlQ29kZWJsb2NrKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBjb25zdCB6b29tUmFuZ2UgPSB0aGlzLmdldFpvb21SYW5nZS5nZXRab29tUmFuZ2UoKTtcbiAgICBjb25zdCBsaXN0SXNab29taW5nUm9vdCA9IEJvb2xlYW4oXG4gICAgICB6b29tUmFuZ2UgJiZcbiAgICAgICAgbGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lID49IHpvb21SYW5nZS5mcm9tLmxpbmUgJiZcbiAgICAgICAgbGlzdC5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKS5saW5lIDw9IHpvb21SYW5nZS5mcm9tLmxpbmVcbiAgICApO1xuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAhbGlzdC5pc0VtcHR5KCk7XG4gICAgY29uc3QgY2hpbGRJc0ZvbGRlZCA9IGxpc3QuaXNGb2xkUm9vdCgpO1xuICAgIGNvbnN0IGVuZFBvcyA9IGxpc3QuZ2V0TGFzdExpbmVDb250ZW50RW5kKCk7XG4gICAgY29uc3QgZW5kT2ZMaW5lID0gY3Vyc29yLmxpbmUgPT09IGVuZFBvcy5saW5lICYmIGN1cnNvci5jaCA9PT0gZW5kUG9zLmNoO1xuXG4gICAgY29uc3Qgb25DaGlsZExldmVsID1cbiAgICAgIGxpc3RJc1pvb21pbmdSb290IHx8IChoYXNDaGlsZHJlbiAmJiAhY2hpbGRJc0ZvbGRlZCAmJiBlbmRPZkxpbmUpO1xuXG4gICAgY29uc3QgaW5kZW50ID0gb25DaGlsZExldmVsXG4gICAgICA/IGhhc0NoaWxkcmVuXG4gICAgICAgID8gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldEZpcnN0TGluZUluZGVudCgpXG4gICAgICAgIDogbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKSArIHRoaXMuZGVmYXVsdEluZGVudENoYXJzXG4gICAgICA6IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCk7XG5cbiAgICBjb25zdCBidWxsZXQgPVxuICAgICAgb25DaGlsZExldmVsICYmIGhhc0NoaWxkcmVuXG4gICAgICAgID8gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldEJ1bGxldCgpXG4gICAgICAgIDogbGlzdC5nZXRCdWxsZXQoKTtcblxuICAgIGNvbnN0IHNwYWNlQWZ0ZXJCdWxsZXQgPVxuICAgICAgb25DaGlsZExldmVsICYmIGhhc0NoaWxkcmVuXG4gICAgICAgID8gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldFNwYWNlQWZ0ZXJCdWxsZXQoKVxuICAgICAgICA6IGxpc3QuZ2V0U3BhY2VBZnRlckJ1bGxldCgpO1xuXG4gICAgY29uc3QgcHJlZml4ID0gb2xkTGluZXNbMF0ubWF0Y2goY2hlY2tib3hSZSkgPyBcIlsgXSBcIiA6IFwiXCI7XG5cbiAgICBjb25zdCBuZXdMaXN0ID0gbmV3IExpc3QoXG4gICAgICBsaXN0LmdldFJvb3QoKSxcbiAgICAgIGluZGVudCxcbiAgICAgIGJ1bGxldCxcbiAgICAgIHByZWZpeCxcbiAgICAgIHNwYWNlQWZ0ZXJCdWxsZXQsXG4gICAgICBwcmVmaXggKyBuZXdMaW5lcy5zaGlmdCgpLFxuICAgICAgZmFsc2VcbiAgICApO1xuXG4gICAgaWYgKG5ld0xpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIG5ld0xpc3Quc2V0Tm90ZXNJbmRlbnQobGlzdC5nZXROb3Rlc0luZGVudCgpKTtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBuZXdMaW5lcykge1xuICAgICAgICBuZXdMaXN0LmFkZExpbmUobGluZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9uQ2hpbGRMZXZlbCkge1xuICAgICAgbGlzdC5hZGRCZWZvcmVBbGwobmV3TGlzdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghY2hpbGRJc0ZvbGRlZCB8fCAhZW5kT2ZMaW5lKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gbGlzdC5nZXRDaGlsZHJlbigpO1xuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgICAgbGlzdC5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICAgICAgbmV3TGlzdC5hZGRBZnRlckFsbChjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGlzdC5nZXRQYXJlbnQoKS5hZGRBZnRlcihsaXN0LCBuZXdMaXN0KTtcbiAgICB9XG5cbiAgICBsaXN0LnJlcGxhY2VMaW5lcyhvbGRMaW5lcyk7XG5cbiAgICBjb25zdCBuZXdMaXN0U3RhcnQgPSBuZXdMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBuZXdMaXN0U3RhcnQubGluZSxcbiAgICAgIGNoOiBuZXdMaXN0U3RhcnQuY2ggKyBwcmVmaXgubGVuZ3RoLFxuICAgIH0pO1xuXG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luXzIgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgUHJlYyB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vTXlFZGl0b3JcIjtcbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi4vZmVhdHVyZXMvRmVhdHVyZVwiO1xuaW1wb3J0IHsgQ3JlYXRlTmV3SXRlbU9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0NyZWF0ZU5ld0l0ZW1PcGVyYXRpb25cIjtcbmltcG9ydCB7IElNRVNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FU2VydmljZVwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2VydmljZVwiO1xuaW1wb3J0IHsgUGVyZm9ybU9wZXJhdGlvblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcIjtcbmltcG9ydCB7IFNldHRpbmdzU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1NlcnZpY2VcIjtcblxuZXhwb3J0IGNsYXNzIEVudGVyU2hvdWxkQ3JlYXRlTmV3SXRlbUZlYXR1cmUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbl8yLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzU2VydmljZSxcbiAgICBwcml2YXRlIGltZTogSU1FU2VydmljZSxcbiAgICBwcml2YXRlIG9ic2lkaWFuOiBPYnNpZGlhblNlcnZpY2UsXG4gICAgcHJpdmF0ZSBwZXJmb3JtT3BlcmF0aW9uOiBQZXJmb3JtT3BlcmF0aW9uU2VydmljZVxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFByZWMuaGlnaGVzdChcbiAgICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBrZXk6IFwiRW50ZXJcIixcbiAgICAgICAgICAgIHJ1bjogdGhpcy5vYnNpZGlhbi5jcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSlcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNoZWNrID0gKCkgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldHRpbmdzLmJldHRlckVudGVyICYmICF0aGlzLmltZS5pc0lNRU9wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCB6b29tUmFuZ2UgPSBlZGl0b3IuZ2V0Wm9vbVJhbmdlKCk7XG5cbiAgICBjb25zdCByZXMgPSB0aGlzLnBlcmZvcm1PcGVyYXRpb24ucGVyZm9ybU9wZXJhdGlvbihcbiAgICAgIChyb290KSA9PlxuICAgICAgICBuZXcgQ3JlYXRlTmV3SXRlbU9wZXJhdGlvbihcbiAgICAgICAgICByb290LFxuICAgICAgICAgIHRoaXMub2JzaWRpYW4uZ2V0RGVmYXVsdEluZGVudENoYXJzKCksXG4gICAgICAgICAge1xuICAgICAgICAgICAgZ2V0Wm9vbVJhbmdlOiAoKSA9PiB6b29tUmFuZ2UsXG4gICAgICAgICAgfVxuICAgICAgICApLFxuICAgICAgZWRpdG9yXG4gICAgKTtcblxuICAgIGlmIChyZXMuc2hvdWxkVXBkYXRlICYmIHpvb21SYW5nZSkge1xuICAgICAgZWRpdG9yLnpvb21Jbih6b29tUmFuZ2UuZnJvbS5saW5lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgTm90aWNlLCBQbHVnaW5fMiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9NeUVkaXRvclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2VydmljZVwiO1xuXG5leHBvcnQgY2xhc3MgRm9sZEZlYXR1cmUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwbHVnaW46IFBsdWdpbl8yLCBwcml2YXRlIG9ic2lkaWFuOiBPYnNpZGlhblNlcnZpY2UpIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImZvbGRcIixcbiAgICAgIGljb246IFwiY2hldnJvbnMtZG93bi11cFwiLFxuICAgICAgbmFtZTogXCJGb2xkIHRoZSBsaXN0XCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogdGhpcy5vYnNpZGlhbi5jcmVhdGVFZGl0b3JDYWxsYmFjayh0aGlzLmZvbGQpLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIl0sXG4gICAgICAgICAga2V5OiBcIkFycm93VXBcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInVuZm9sZFwiLFxuICAgICAgaWNvbjogXCJjaGV2cm9ucy11cC1kb3duXCIsXG4gICAgICBuYW1lOiBcIlVuZm9sZCB0aGUgbGlzdFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IHRoaXMub2JzaWRpYW4uY3JlYXRlRWRpdG9yQ2FsbGJhY2sodGhpcy51bmZvbGQpLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIl0sXG4gICAgICAgICAga2V5OiBcIkFycm93RG93blwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBzZXRGb2xkKGVkaXRvcjogTXlFZGl0b3IsIHR5cGU6IFwiZm9sZFwiIHwgXCJ1bmZvbGRcIikge1xuICAgIGlmICghdGhpcy5vYnNpZGlhbi5nZXRPYnNpZGlhbkZvbGRTZXR0aW5ncygpLmZvbGRJbmRlbnQpIHtcbiAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgIGBVbmFibGUgdG8gJHt0eXBlfSBiZWNhdXNlIGZvbGRpbmcgaXMgZGlzYWJsZWQuIFBsZWFzZSBlbmFibGUgXCJGb2xkIGluZGVudFwiIGluIE9ic2lkaWFuIHNldHRpbmdzLmAsXG4gICAgICAgIDUwMDBcbiAgICAgICk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG5cbiAgICBpZiAodHlwZSA9PT0gXCJmb2xkXCIpIHtcbiAgICAgIGVkaXRvci5mb2xkKGN1cnNvci5saW5lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWRpdG9yLnVuZm9sZChjdXJzb3IubGluZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBwcml2YXRlIGZvbGQgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldEZvbGQoZWRpdG9yLCBcImZvbGRcIik7XG4gIH07XG5cbiAgcHJpdmF0ZSB1bmZvbGQgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldEZvbGQoZWRpdG9yLCBcInVuZm9sZFwiKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IFBsdWdpbl8yLCBlZGl0b3JJbmZvRmllbGQgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHtcbiAgRWRpdG9yVmlldyxcbiAgUGx1Z2luVmFsdWUsXG4gIFZpZXdQbHVnaW4sXG4gIFZpZXdVcGRhdGUsXG59IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL015RWRpdG9yXCI7XG5pbXBvcnQgeyBMaXN0IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNlcnZpY2VcIjtcbmltcG9ydCB7IFBhcnNlclNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvUGFyc2VyU2VydmljZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5pbnRlcmZhY2UgTGluZURhdGEge1xuICB0b3A6IG51bWJlcjtcbiAgbGVmdDogbnVtYmVyO1xuICBoZWlnaHQ6IHN0cmluZztcbiAgbGlzdDogTGlzdDtcbn1cblxuY2xhc3MgTGlzdExpbmVzVmlld1BsdWdpblZhbHVlIGltcGxlbWVudHMgUGx1Z2luVmFsdWUge1xuICBwcml2YXRlIHNjaGVkdWxlZDogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD47XG4gIHByaXZhdGUgc2Nyb2xsZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNvbnRlbnRDb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVkaXRvcjogTXlFZGl0b3I7XG4gIHByaXZhdGUgbGFzdExpbmU6IG51bWJlcjtcbiAgcHJpdmF0ZSBsaW5lczogTGluZURhdGFbXTtcbiAgcHJpdmF0ZSBsaW5lRWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UsXG4gICAgcHJpdmF0ZSBvYnNpZGlhbjogT2JzaWRpYW5TZXJ2aWNlLFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXJTZXJ2aWNlLFxuICAgIHByaXZhdGUgdmlldzogRWRpdG9yVmlld1xuICApIHtcbiAgICB0aGlzLnZpZXcuc2Nyb2xsRE9NLmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5vblNjcm9sbCk7XG4gICAgdGhpcy5zZXR0aW5ncy5vbkNoYW5nZShcImxpc3RMaW5lc1wiLCB0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUpO1xuXG4gICAgdGhpcy5wcmVwYXJlRG9tKCk7XG4gICAgdGhpcy53YWl0Rm9yRWRpdG9yKCk7XG4gIH1cblxuICBwcml2YXRlIHdhaXRGb3JFZGl0b3IgPSAoKSA9PiB7XG4gICAgY29uc3Qgb2UgPSB0aGlzLnZpZXcuc3RhdGUuZmllbGQoZWRpdG9ySW5mb0ZpZWxkKS5lZGl0b3I7XG4gICAgaWYgKCFvZSkge1xuICAgICAgc2V0VGltZW91dCh0aGlzLndhaXRGb3JFZGl0b3IsIDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmVkaXRvciA9IG5ldyBNeUVkaXRvcihvZSk7XG4gICAgdGhpcy5zY2hlZHVsZVJlY2FsY3VsYXRlKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBwcmVwYXJlRG9tKCkge1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5jb250ZW50Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoXG4gICAgICBcIm91dGxpbmVyLXBsdWdpbi1saXN0LWxpbmVzLWNvbnRlbnQtY29udGFpbmVyXCJcbiAgICApO1xuXG4gICAgdGhpcy5zY3JvbGxlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5zY3JvbGxlci5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWxpc3QtbGluZXMtc2Nyb2xsZXJcIik7XG5cbiAgICB0aGlzLnNjcm9sbGVyLmFwcGVuZENoaWxkKHRoaXMuY29udGVudENvbnRhaW5lcik7XG4gICAgdGhpcy52aWV3LmRvbS5hcHBlbmRDaGlsZCh0aGlzLnNjcm9sbGVyKTtcbiAgfVxuXG4gIHByaXZhdGUgb25TY3JvbGwgPSAoZTogRXZlbnQpID0+IHtcbiAgICBjb25zdCB7IHNjcm9sbExlZnQsIHNjcm9sbFRvcCB9ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5zY3JvbGxlci5zY3JvbGxUbyhzY3JvbGxMZWZ0LCBzY3JvbGxUb3ApO1xuICB9O1xuXG4gIHByaXZhdGUgc2NoZWR1bGVSZWNhbGN1bGF0ZSA9ICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5zY2hlZHVsZWQpO1xuICAgIHRoaXMuc2NoZWR1bGVkID0gc2V0VGltZW91dCh0aGlzLmNhbGN1bGF0ZSwgMCk7XG4gIH07XG5cbiAgdXBkYXRlKHVwZGF0ZTogVmlld1VwZGF0ZSkge1xuICAgIGlmIChcbiAgICAgIHVwZGF0ZS5kb2NDaGFuZ2VkIHx8XG4gICAgICB1cGRhdGUudmlld3BvcnRDaGFuZ2VkIHx8XG4gICAgICB1cGRhdGUuZ2VvbWV0cnlDaGFuZ2VkIHx8XG4gICAgICB1cGRhdGUudHJhbnNhY3Rpb25zLnNvbWUoKHRyKSA9PiB0ci5yZWNvbmZpZ3VyZWQpXG4gICAgKSB7XG4gICAgICB0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZSA9ICgpID0+IHtcbiAgICB0aGlzLmxpbmVzID0gW107XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnNldHRpbmdzLmxpc3RMaW5lcyAmJlxuICAgICAgdGhpcy5vYnNpZGlhbi5pc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSAmJlxuICAgICAgdGhpcy52aWV3LnZpZXdwb3J0TGluZUJsb2Nrcy5sZW5ndGggPiAwICYmXG4gICAgICB0aGlzLnZpZXcudmlzaWJsZVJhbmdlcy5sZW5ndGggPiAwXG4gICAgKSB7XG4gICAgICBjb25zdCBmcm9tTGluZSA9IHRoaXMuZWRpdG9yLm9mZnNldFRvUG9zKHRoaXMudmlldy52aWV3cG9ydC5mcm9tKS5saW5lO1xuICAgICAgY29uc3QgdG9MaW5lID0gdGhpcy5lZGl0b3Iub2Zmc2V0VG9Qb3ModGhpcy52aWV3LnZpZXdwb3J0LnRvKS5saW5lO1xuICAgICAgY29uc3QgbGlzdHMgPSB0aGlzLnBhcnNlci5wYXJzZVJhbmdlKHRoaXMuZWRpdG9yLCBmcm9tTGluZSwgdG9MaW5lKTtcblxuICAgICAgZm9yIChjb25zdCBsaXN0IG9mIGxpc3RzKSB7XG4gICAgICAgIHRoaXMubGFzdExpbmUgPSBsaXN0LmdldFJhbmdlKClbMV0ubGluZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGMgb2YgbGlzdC5nZXRDaGlsZHJlbigpKSB7XG4gICAgICAgICAgdGhpcy5yZWN1cnNpdmUoYyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5saW5lcy5zb3J0KChhLCBiKSA9PlxuICAgICAgICBhLnRvcCA9PT0gYi50b3AgPyBhLmxlZnQgLSBiLmxlZnQgOiBhLnRvcCAtIGIudG9wXG4gICAgICApO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlRG9tKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBnZXROZXh0U2libGluZyhsaXN0OiBMaXN0KTogTGlzdCB8IG51bGwge1xuICAgIGxldCBsaXN0VG1wID0gbGlzdDtcbiAgICBsZXQgcCA9IGxpc3RUbXAuZ2V0UGFyZW50KCk7XG4gICAgd2hpbGUgKHApIHtcbiAgICAgIGNvbnN0IG5leHRTaWJsaW5nID0gcC5nZXROZXh0U2libGluZ09mKGxpc3RUbXApO1xuICAgICAgaWYgKG5leHRTaWJsaW5nKSB7XG4gICAgICAgIHJldHVybiBuZXh0U2libGluZztcbiAgICAgIH1cbiAgICAgIGxpc3RUbXAgPSBwO1xuICAgICAgcCA9IGxpc3RUbXAuZ2V0UGFyZW50KCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSByZWN1cnNpdmUobGlzdDogTGlzdCwgcGFyZW50Q3R4OiB7IHJvb3RMZWZ0PzogbnVtYmVyIH0gPSB7fSkge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gbGlzdC5nZXRDaGlsZHJlbigpO1xuXG4gICAgaWYgKGNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZyb21PZmZzZXQgPSB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh7XG4gICAgICBsaW5lOiBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICBjaDogbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgsXG4gICAgfSk7XG4gICAgY29uc3QgbmV4dFNpYmxpbmcgPSB0aGlzLmdldE5leHRTaWJsaW5nKGxpc3QpO1xuICAgIGNvbnN0IHRpbGxPZmZzZXQgPSB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh7XG4gICAgICBsaW5lOiBuZXh0U2libGluZ1xuICAgICAgICA/IG5leHRTaWJsaW5nLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUgLSAxXG4gICAgICAgIDogdGhpcy5sYXN0TGluZSxcbiAgICAgIGNoOiAwLFxuICAgIH0pO1xuXG4gICAgbGV0IHZpc2libGVGcm9tID0gdGhpcy52aWV3LnZpc2libGVSYW5nZXNbMF0uZnJvbTtcbiAgICBsZXQgdmlzaWJsZVRvID1cbiAgICAgIHRoaXMudmlldy52aXNpYmxlUmFuZ2VzW3RoaXMudmlldy52aXNpYmxlUmFuZ2VzLmxlbmd0aCAtIDFdLnRvO1xuICAgIGNvbnN0IHpvb21SYW5nZSA9IHRoaXMuZWRpdG9yLmdldFpvb21SYW5nZSgpO1xuICAgIGlmICh6b29tUmFuZ2UpIHtcbiAgICAgIHZpc2libGVGcm9tID0gTWF0aC5tYXgoXG4gICAgICAgIHZpc2libGVGcm9tLFxuICAgICAgICB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh6b29tUmFuZ2UuZnJvbSlcbiAgICAgICk7XG4gICAgICB2aXNpYmxlVG8gPSBNYXRoLm1pbih2aXNpYmxlVG8sIHRoaXMuZWRpdG9yLnBvc1RvT2Zmc2V0KHpvb21SYW5nZS50bykpO1xuICAgIH1cblxuICAgIGlmIChmcm9tT2Zmc2V0ID4gdmlzaWJsZVRvIHx8IHRpbGxPZmZzZXQgPCB2aXNpYmxlRnJvbSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNvb3JkcyA9IHRoaXMudmlldy5jb29yZHNBdFBvcyhmcm9tT2Zmc2V0LCAxKTtcbiAgICBpZiAocGFyZW50Q3R4LnJvb3RMZWZ0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmVudEN0eC5yb290TGVmdCA9IGNvb3Jkcy5sZWZ0O1xuICAgIH1cbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5mbG9vcihjb29yZHMucmlnaHQgLSBwYXJlbnRDdHgucm9vdExlZnQpO1xuXG4gICAgY29uc3QgdG9wID1cbiAgICAgIHZpc2libGVGcm9tID4gMCAmJiBmcm9tT2Zmc2V0IDwgdmlzaWJsZUZyb21cbiAgICAgICAgPyAtMjBcbiAgICAgICAgOiB0aGlzLnZpZXcubGluZUJsb2NrQXQoZnJvbU9mZnNldCkudG9wO1xuICAgIGNvbnN0IGJvdHRvbSA9XG4gICAgICB0aWxsT2Zmc2V0ID4gdmlzaWJsZVRvXG4gICAgICAgID8gdGhpcy52aWV3LmxpbmVCbG9ja0F0KHZpc2libGVUbyAtIDEpLmJvdHRvbVxuICAgICAgICA6IHRoaXMudmlldy5saW5lQmxvY2tBdCh0aWxsT2Zmc2V0KS5ib3R0b207XG4gICAgY29uc3QgaGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xuXG4gICAgaWYgKGhlaWdodCA+IDAgJiYgIWxpc3QuaXNGb2xkZWQoKSkge1xuICAgICAgY29uc3QgbmV4dFNpYmxpbmcgPSBsaXN0LmdldFBhcmVudCgpLmdldE5leHRTaWJsaW5nT2YobGlzdCk7XG4gICAgICBjb25zdCBoYXNOZXh0U2libGluZyA9XG4gICAgICAgICEhbmV4dFNpYmxpbmcgJiZcbiAgICAgICAgdGhpcy5lZGl0b3IucG9zVG9PZmZzZXQobmV4dFNpYmxpbmcuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkpIDw9XG4gICAgICAgICAgdmlzaWJsZVRvO1xuXG4gICAgICB0aGlzLmxpbmVzLnB1c2goe1xuICAgICAgICB0b3AsXG4gICAgICAgIGxlZnQsXG4gICAgICAgIGhlaWdodDogYGNhbGMoJHtoZWlnaHR9cHggJHtoYXNOZXh0U2libGluZyA/IFwiLSAxLjVlbVwiIDogXCItIDJlbVwifSlgLFxuICAgICAgICBsaXN0LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikge1xuICAgICAgaWYgKCFjaGlsZC5pc0VtcHR5KCkpIHtcbiAgICAgICAgdGhpcy5yZWN1cnNpdmUoY2hpbGQsIHBhcmVudEN0eCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBvbkNsaWNrID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBjb25zdCBsaW5lID0gdGhpcy5saW5lc1tOdW1iZXIoKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5kYXRhc2V0LmluZGV4KV07XG5cbiAgICBzd2l0Y2ggKHRoaXMuc2V0dGluZ3MubGlzdExpbmVBY3Rpb24pIHtcbiAgICAgIGNhc2UgXCJ6b29tLWluXCI6XG4gICAgICAgIHRoaXMuem9vbUluKGxpbmUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcInRvZ2dsZS1mb2xkaW5nXCI6XG4gICAgICAgIHRoaXMudG9nZ2xlRm9sZGluZyhsaW5lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgem9vbUluKGxpbmU6IExpbmVEYXRhKSB7XG4gICAgY29uc3QgZWRpdG9yID0gbmV3IE15RWRpdG9yKHRoaXMudmlldy5zdGF0ZS5maWVsZChlZGl0b3JJbmZvRmllbGQpLmVkaXRvcik7XG5cbiAgICBlZGl0b3Iuem9vbUluKGxpbmUubGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgfVxuXG4gIHByaXZhdGUgdG9nZ2xlRm9sZGluZyhsaW5lOiBMaW5lRGF0YSkge1xuICAgIGNvbnN0IHsgbGlzdCB9ID0gbGluZTtcblxuICAgIGlmIChsaXN0LmlzRW1wdHkoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBuZWVkVG9VbmZvbGQgPSB0cnVlO1xuICAgIGNvbnN0IGxpbmVzVG9Ub2dnbGU6IG51bWJlcltdID0gW107XG4gICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgaWYgKGMuaXNFbXB0eSgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFjLmlzRm9sZGVkKCkpIHtcbiAgICAgICAgbmVlZFRvVW5mb2xkID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBsaW5lc1RvVG9nZ2xlLnB1c2goYy5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgICB9XG5cbiAgICBjb25zdCBlZGl0b3IgPSBuZXcgTXlFZGl0b3IodGhpcy52aWV3LnN0YXRlLmZpZWxkKGVkaXRvckluZm9GaWVsZCkuZWRpdG9yKTtcblxuICAgIGZvciAoY29uc3QgbCBvZiBsaW5lc1RvVG9nZ2xlKSB7XG4gICAgICBpZiAobmVlZFRvVW5mb2xkKSB7XG4gICAgICAgIGVkaXRvci51bmZvbGQobCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlZGl0b3IuZm9sZChsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZURvbSgpIHtcbiAgICBjb25zdCBjbVNjcm9sbCA9IHRoaXMudmlldy5zY3JvbGxET007XG4gICAgY29uc3QgY21Db250ZW50ID0gdGhpcy52aWV3LmNvbnRlbnRET007XG4gICAgY29uc3QgY21Db250ZW50Q29udGFpbmVyID0gY21Db250ZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgY29uc3QgY21TaXplciA9IGNtQ29udGVudENvbnRhaW5lci5wYXJlbnRFbGVtZW50O1xuXG4gICAgLyoqXG4gICAgICogT2JzaWRpYW4gY2FuIGFkZCBhZGRpdGlvbmFsIGVsZW1lbnRzIGludG8gQ29udGVudCBNYW5hZ2VyLlxuICAgICAqIFRoZSBtb3N0IG9idmlvdXMgY2FzZSBpcyB0aGUgJ2VtYmVkZGVkLWJhY2tsaW5rcycgY29yZSBwbHVnaW4gdGhhdCBhZGRzIGEgbWVudSBpbnNpZGUgYSBDb250ZW50IE1hbmFnZXIuXG4gICAgICogV2UgbXVzdCB0YWtlIGhlaWdodHMgb2YgYWxsIG9mIHRoZXNlIGVsZW1lbnRzIGludG8gYWNjb3VudFxuICAgICAqIHRvIGJlIGFibGUgdG8gY2FsY3VsYXRlIHRoZSBjb3JyZWN0IHNpemUgb2YgbGluZXMnIGNvbnRhaW5lci5cbiAgICAgKi9cbiAgICBsZXQgY21TaXplckNoaWxkcmVuU3VtSGVpZ2h0ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNtU2l6ZXIuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNtU2l6ZXJDaGlsZHJlblN1bUhlaWdodCArPSBjbVNpemVyLmNoaWxkcmVuW2ldLmNsaWVudEhlaWdodDtcbiAgICB9XG5cbiAgICB0aGlzLnNjcm9sbGVyLnN0eWxlLnRvcCA9IGNtU2Nyb2xsLm9mZnNldFRvcCArIFwicHhcIjtcbiAgICB0aGlzLmNvbnRlbnRDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY21TaXplckNoaWxkcmVuU3VtSGVpZ2h0ICsgXCJweFwiO1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lci5zdHlsZS5tYXJnaW5MZWZ0ID1cbiAgICAgIGNtQ29udGVudENvbnRhaW5lci5vZmZzZXRMZWZ0ICsgXCJweFwiO1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lci5zdHlsZS5tYXJnaW5Ub3AgPVxuICAgICAgKGNtQ29udGVudC5maXJzdEVsZW1lbnRDaGlsZCBhcyBIVE1MRWxlbWVudCkub2Zmc2V0VG9wIC0gMjQgKyBcInB4XCI7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLmxpbmVFbGVtZW50cy5sZW5ndGggPT09IGkpIHtcbiAgICAgICAgY29uc3QgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIGUuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1saXN0LWxpbmVcIik7XG4gICAgICAgIGUuZGF0YXNldC5pbmRleCA9IFN0cmluZyhpKTtcbiAgICAgICAgZS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMub25DbGljayk7XG4gICAgICAgIHRoaXMuY29udGVudENvbnRhaW5lci5hcHBlbmRDaGlsZChlKTtcbiAgICAgICAgdGhpcy5saW5lRWxlbWVudHMucHVzaChlKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbCA9IHRoaXMubGluZXNbaV07XG4gICAgICBjb25zdCBlID0gdGhpcy5saW5lRWxlbWVudHNbaV07XG4gICAgICBlLnN0eWxlLnRvcCA9IGwudG9wICsgXCJweFwiO1xuICAgICAgZS5zdHlsZS5sZWZ0ID0gbC5sZWZ0ICsgXCJweFwiO1xuICAgICAgZS5zdHlsZS5oZWlnaHQgPSBsLmhlaWdodDtcbiAgICAgIGUuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gdGhpcy5saW5lcy5sZW5ndGg7IGkgPCB0aGlzLmxpbmVFbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZSA9IHRoaXMubGluZUVsZW1lbnRzW2ldO1xuICAgICAgZS5zdHlsZS50b3AgPSBcIjBweFwiO1xuICAgICAgZS5zdHlsZS5sZWZ0ID0gXCIwcHhcIjtcbiAgICAgIGUuc3R5bGUuaGVpZ2h0ID0gXCIwcHhcIjtcbiAgICAgIGUuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zZXR0aW5ncy5yZW1vdmVDYWxsYmFjayhcImxpc3RMaW5lc1wiLCB0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUpO1xuICAgIHRoaXMudmlldy5zY3JvbGxET00ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLm9uU2Nyb2xsKTtcbiAgICB0aGlzLnZpZXcuZG9tLnJlbW92ZUNoaWxkKHRoaXMuc2Nyb2xsZXIpO1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnNjaGVkdWxlZCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIExpbmVzRmVhdHVyZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luXzIsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NTZXJ2aWNlLFxuICAgIHByaXZhdGUgb2JzaWRpYW46IE9ic2lkaWFuU2VydmljZSxcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyU2VydmljZVxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFZpZXdQbHVnaW4uZGVmaW5lKFxuICAgICAgICAodmlldykgPT5cbiAgICAgICAgICBuZXcgTGlzdExpbmVzVmlld1BsdWdpblZhbHVlKFxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgICAgIHRoaXMub2JzaWRpYW4sXG4gICAgICAgICAgICB0aGlzLnBhcnNlcixcbiAgICAgICAgICAgIHZpZXdcbiAgICAgICAgICApXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG59XG4iLCJpbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBTZXR0aW5nc1NlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NTZXJ2aWNlXCI7XG5cbmNvbnN0IEJFVFRFUl9MSVNUU19DTEFTUyA9IFwib3V0bGluZXItcGx1Z2luLWJldHRlci1saXN0c1wiO1xuY29uc3QgQkVUVEVSX0JVTExFVFNfQ0xBU1MgPSBcIm91dGxpbmVyLXBsdWdpbi1iZXR0ZXItYnVsbGV0c1wiO1xuY29uc3QgVkVSVElDQUxfTElORVMgPSBcIm91dGxpbmVyLXBsdWdpbi12ZXJ0aWNhbC1saW5lc1wiO1xuY29uc3QgS05PV05fQ0xBU1NFUyA9IFtcbiAgQkVUVEVSX0xJU1RTX0NMQVNTLFxuICBCRVRURVJfQlVMTEVUU19DTEFTUyxcbiAgVkVSVElDQUxfTElORVMsXG5dO1xuXG5leHBvcnQgY2xhc3MgTGlzdHNTdHlsZXNGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgaW50ZXJ2YWw6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UsXG4gICAgcHJpdmF0ZSBvYnNpZGlhbjogT2JzaWRpYW5TZXJ2aWNlXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMuc3luY0xpc3RzU3R5bGVzKCk7XG4gICAgdGhpcy5pbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnN5bmNMaXN0c1N0eWxlcygpO1xuICAgIH0sIDEwMDApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgdGhpcy5hcHBseUxpc3RzU3R5bGVzKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY0xpc3RzU3R5bGVzID0gKCkgPT4ge1xuICAgIGNvbnN0IGNsYXNzZXMgPSBbXTtcblxuICAgIGlmICh0aGlzLm9ic2lkaWFuLmlzRGVmYXVsdFRoZW1lRW5hYmxlZCgpKSB7XG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5zdHlsZUxpc3RzKSB7XG4gICAgICAgIGNsYXNzZXMucHVzaChCRVRURVJfTElTVFNfQ0xBU1MpO1xuICAgICAgICBjbGFzc2VzLnB1c2goQkVUVEVSX0JVTExFVFNfQ0xBU1MpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5zZXR0aW5ncy5saXN0TGluZXMpIHtcbiAgICAgICAgY2xhc3Nlcy5wdXNoKFZFUlRJQ0FMX0xJTkVTKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmFwcGx5TGlzdHNTdHlsZXMoY2xhc3Nlcyk7XG4gIH07XG5cbiAgcHJpdmF0ZSBhcHBseUxpc3RzU3R5bGVzKGNsYXNzZXM6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgdG9LZWVwID0gY2xhc3Nlcy5maWx0ZXIoKGMpID0+IEtOT1dOX0NMQVNTRVMuY29udGFpbnMoYykpO1xuICAgIGNvbnN0IHRvUmVtb3ZlID0gS05PV05fQ0xBU1NFUy5maWx0ZXIoKGMpID0+ICF0b0tlZXAuY29udGFpbnMoYykpO1xuXG4gICAgZm9yIChjb25zdCBjIG9mIHRvS2VlcCkge1xuICAgICAgaWYgKCFkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhjKSkge1xuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoYyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjIG9mIHRvUmVtb3ZlKSB7XG4gICAgICBpZiAoZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuY29udGFpbnMoYykpIHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKGMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IExpc3RMaW5lLCBQb3NpdGlvbiwgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZU9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSB0aGlzLnJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5yb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoKGwpID0+IHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIGN1cnNvci5jaCA9PT0gbC5mcm9tLmNoICsgbGlzdC5nZXRDaGVja2JveExlbmd0aCgpICYmXG4gICAgICAgIGN1cnNvci5saW5lID09PSBsLmZyb20ubGluZVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGlmIChsaW5lTm8gPT09IDApIHtcbiAgICAgIHRoaXMubW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZEl0ZW0ocm9vdCwgY3Vyc29yKTtcbiAgICB9IGVsc2UgaWYgKGxpbmVObyA+IDApIHtcbiAgICAgIHRoaXMubW92ZUN1cnNvclRvUHJldmlvdXNOb3RlTGluZShyb290LCBsaW5lcywgbGluZU5vKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1vdmVDdXJzb3JUb1ByZXZpb3VzTm90ZUxpbmUoXG4gICAgcm9vdDogUm9vdCxcbiAgICBsaW5lczogTGlzdExpbmVbXSxcbiAgICBsaW5lTm86IG51bWJlclxuICApIHtcbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIHJvb3QucmVwbGFjZUN1cnNvcihsaW5lc1tsaW5lTm8gLSAxXS50byk7XG4gIH1cblxuICBwcml2YXRlIG1vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRJdGVtKHJvb3Q6IFJvb3QsIGN1cnNvcjogUG9zaXRpb24pIHtcbiAgICBjb25zdCBwcmV2ID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKGN1cnNvci5saW5lIC0gMSk7XG5cbiAgICBpZiAoIXByZXYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGlmIChwcmV2LmlzRm9sZGVkKCkpIHtcbiAgICAgIGNvbnN0IGZvbGRSb290ID0gcHJldi5nZXRUb3BGb2xkUm9vdCgpO1xuICAgICAgY29uc3QgZmlyc3RMaW5lRW5kID0gZm9sZFJvb3QuZ2V0TGluZXNJbmZvKClbMF0udG87XG4gICAgICByb290LnJlcGxhY2VDdXJzb3IoZmlyc3RMaW5lRW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHByZXYuZ2V0TGFzdExpbmVDb250ZW50RW5kKCkpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luXzIgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vTXlFZGl0b3JcIjtcbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi4vZmVhdHVyZXMvRmVhdHVyZVwiO1xuaW1wb3J0IHsgTW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZExpbmVPcGVyYXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZU9wZXJhdGlvblwiO1xuaW1wb3J0IHsgSU1FU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVTZXJ2aWNlXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQZXJmb3JtT3BlcmF0aW9uU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QZXJmb3JtT3BlcmF0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5leHBvcnQgY2xhc3MgTW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZExpbmVGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW5fMixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UsXG4gICAgcHJpdmF0ZSBpbWU6IElNRVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBvYnNpZGlhbjogT2JzaWRpYW5TZXJ2aWNlLFxuICAgIHByaXZhdGUgcGVyZm9ybU9wZXJhdGlvbjogUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcIkFycm93TGVmdFwiLFxuICAgICAgICAgIHJ1bjogdGhpcy5vYnNpZGlhbi5jcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB3aW46IFwiYy1BcnJvd0xlZnRcIixcbiAgICAgICAgICBsaW51eDogXCJjLUFycm93TGVmdFwiLFxuICAgICAgICAgIHJ1bjogdGhpcy5vYnNpZGlhbi5jcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICBdKVxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3Muc3RpY2tDdXJzb3IgIT0gXCJuZXZlclwiICYmICF0aGlzLmltZS5pc0lNRU9wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5wZXJmb3JtT3BlcmF0aW9uLnBlcmZvcm1PcGVyYXRpb24oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lT3BlcmF0aW9uKHJvb3QpLFxuICAgICAgZWRpdG9yXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdC9yZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzXCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlRG93bk9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXJlbnQuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgbmV4dCA9IHBhcmVudC5nZXROZXh0U2libGluZ09mKGxpc3QpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcblxuICAgIGlmICghbmV4dCAmJiBncmFuZFBhcmVudCkge1xuICAgICAgY29uc3QgbmV3UGFyZW50ID0gZ3JhbmRQYXJlbnQuZ2V0TmV4dFNpYmxpbmdPZihwYXJlbnQpO1xuXG4gICAgICBpZiAobmV3UGFyZW50KSB7XG4gICAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgICAgbmV3UGFyZW50LmFkZEJlZm9yZUFsbChsaXN0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHQpIHtcbiAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgICBwYXJlbnQuYWRkQWZ0ZXIobmV4dCwgbGlzdCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVwZGF0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2gsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5pbXBvcnQgeyByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3QvcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0c1wiO1xuXG5leHBvcnQgY2xhc3MgTW92ZVJpZ2h0T3BlcmF0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290LCBwcml2YXRlIGRlZmF1bHRJbmRlbnRDaGFyczogc3RyaW5nKSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgcGFyZW50ID0gbGlzdC5nZXRQYXJlbnQoKTtcbiAgICBjb25zdCBwcmV2ID0gcGFyZW50LmdldFByZXZTaWJsaW5nT2YobGlzdCk7XG5cbiAgICBpZiAoIXByZXYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcblxuICAgIGNvbnN0IGluZGVudFBvcyA9IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoO1xuICAgIGxldCBpbmRlbnRDaGFycyA9IFwiXCI7XG5cbiAgICBpZiAoaW5kZW50Q2hhcnMgPT09IFwiXCIgJiYgIXByZXYuaXNFbXB0eSgpKSB7XG4gICAgICBpbmRlbnRDaGFycyA9IHByZXZcbiAgICAgICAgLmdldENoaWxkcmVuKClbMF1cbiAgICAgICAgLmdldEZpcnN0TGluZUluZGVudCgpXG4gICAgICAgIC5zbGljZShwcmV2LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgaWYgKGluZGVudENoYXJzID09PSBcIlwiKSB7XG4gICAgICBpbmRlbnRDaGFycyA9IGxpc3RcbiAgICAgICAgLmdldEZpcnN0TGluZUluZGVudCgpXG4gICAgICAgIC5zbGljZShwYXJlbnQuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBpZiAoaW5kZW50Q2hhcnMgPT09IFwiXCIgJiYgIWxpc3QuaXNFbXB0eSgpKSB7XG4gICAgICBpbmRlbnRDaGFycyA9IGxpc3QuZ2V0Q2hpbGRyZW4oKVswXS5nZXRGaXJzdExpbmVJbmRlbnQoKTtcbiAgICB9XG5cbiAgICBpZiAoaW5kZW50Q2hhcnMgPT09IFwiXCIpIHtcbiAgICAgIGluZGVudENoYXJzID0gdGhpcy5kZWZhdWx0SW5kZW50Q2hhcnM7XG4gICAgfVxuXG4gICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgIHByZXYuYWRkQWZ0ZXJBbGwobGlzdCk7XG4gICAgbGlzdC5pbmRlbnRDb250ZW50KGluZGVudFBvcywgaW5kZW50Q2hhcnMpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUFmdGVyID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gbGlzdFN0YXJ0TGluZUFmdGVyIC0gbGlzdFN0YXJ0TGluZUJlZm9yZTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lICsgbGluZURpZmYsXG4gICAgICBjaDogY3Vyc29yLmNoICsgaW5kZW50Q2hhcnMubGVuZ3RoLFxuICAgIH0pO1xuXG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290L3JlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHNcIjtcblxuZXhwb3J0IGNsYXNzIE1vdmVVcE9wZXJhdGlvbiBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXJlbnQuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgcHJldiA9IHBhcmVudC5nZXRQcmV2U2libGluZ09mKGxpc3QpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcblxuICAgIGlmICghcHJldiAmJiBncmFuZFBhcmVudCkge1xuICAgICAgY29uc3QgbmV3UGFyZW50ID0gZ3JhbmRQYXJlbnQuZ2V0UHJldlNpYmxpbmdPZihwYXJlbnQpO1xuXG4gICAgICBpZiAobmV3UGFyZW50KSB7XG4gICAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgICAgbmV3UGFyZW50LmFkZEFmdGVyQWxsKGxpc3QpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJldikge1xuICAgICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgIHBhcmVudC5hZGRCZWZvcmUocHJldiwgbGlzdCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVwZGF0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2gsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW5fMiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBQcmVjIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5pbXBvcnQgeyBrZXltYXAgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9NeUVkaXRvclwiO1xuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuLi9mZWF0dXJlcy9GZWF0dXJlXCI7XG5pbXBvcnQgeyBNb3ZlRG93bk9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL01vdmVEb3duT3BlcmF0aW9uXCI7XG5pbXBvcnQgeyBNb3ZlTGVmdE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL01vdmVMZWZ0T3BlcmF0aW9uXCI7XG5pbXBvcnQgeyBNb3ZlUmlnaHRPcGVyYXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlUmlnaHRPcGVyYXRpb25cIjtcbmltcG9ydCB7IE1vdmVVcE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL01vdmVVcE9wZXJhdGlvblwiO1xuaW1wb3J0IHsgSU1FU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVTZXJ2aWNlXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQZXJmb3JtT3BlcmF0aW9uU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QZXJmb3JtT3BlcmF0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5leHBvcnQgY2xhc3MgTW92ZUl0ZW1zRmVhdHVyZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luXzIsXG4gICAgcHJpdmF0ZSBpbWU6IElNRVNlcnZpY2UsXG4gICAgcHJpdmF0ZSBvYnNpZGlhbjogT2JzaWRpYW5TZXJ2aWNlLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzU2VydmljZSxcbiAgICBwcml2YXRlIHBlcmZvcm1PcGVyYXRpb246IFBlcmZvcm1PcGVyYXRpb25TZXJ2aWNlXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibW92ZS1saXN0LWl0ZW0tdXBcIixcbiAgICAgIGljb246IFwiYXJyb3ctdXBcIixcbiAgICAgIG5hbWU6IFwiTW92ZSBsaXN0IGFuZCBzdWJsaXN0cyB1cFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IHRoaXMub2JzaWRpYW4uY3JlYXRlRWRpdG9yQ2FsbGJhY2soXG4gICAgICAgIHRoaXMubW92ZUxpc3RFbGVtZW50VXBDb21tYW5kXG4gICAgICApLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIiwgXCJTaGlmdFwiXSxcbiAgICAgICAgICBrZXk6IFwiQXJyb3dVcFwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibW92ZS1saXN0LWl0ZW0tZG93blwiLFxuICAgICAgaWNvbjogXCJhcnJvdy1kb3duXCIsXG4gICAgICBuYW1lOiBcIk1vdmUgbGlzdCBhbmQgc3VibGlzdHMgZG93blwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IHRoaXMub2JzaWRpYW4uY3JlYXRlRWRpdG9yQ2FsbGJhY2soXG4gICAgICAgIHRoaXMubW92ZUxpc3RFbGVtZW50RG93bkNvbW1hbmRcbiAgICAgICksXG4gICAgICBob3RrZXlzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiLCBcIlNoaWZ0XCJdLFxuICAgICAgICAgIGtleTogXCJBcnJvd0Rvd25cIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluZGVudC1saXN0XCIsXG4gICAgICBpY29uOiBcImluZGVudFwiLFxuICAgICAgbmFtZTogXCJJbmRlbnQgdGhlIGxpc3QgYW5kIHN1Ymxpc3RzXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogdGhpcy5vYnNpZGlhbi5jcmVhdGVFZGl0b3JDYWxsYmFjayhcbiAgICAgICAgdGhpcy5tb3ZlTGlzdEVsZW1lbnRSaWdodENvbW1hbmRcbiAgICAgICksXG4gICAgICBob3RrZXlzOiBbXSxcbiAgICB9KTtcblxuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3V0ZGVudC1saXN0XCIsXG4gICAgICBpY29uOiBcIm91dGRlbnRcIixcbiAgICAgIG5hbWU6IFwiT3V0ZGVudCB0aGUgbGlzdCBhbmQgc3VibGlzdHNcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiB0aGlzLm9ic2lkaWFuLmNyZWF0ZUVkaXRvckNhbGxiYWNrKFxuICAgICAgICB0aGlzLm1vdmVMaXN0RWxlbWVudExlZnRDb21tYW5kXG4gICAgICApLFxuICAgICAgaG90a2V5czogW10sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFByZWMuaGlnaGVzdChcbiAgICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBrZXk6IFwiVGFiXCIsXG4gICAgICAgICAgICBydW46IHRoaXMub2JzaWRpYW4uY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgICAgcnVuOiB0aGlzLm1vdmVMaXN0RWxlbWVudFJpZ2h0LFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBrZXk6IFwicy1UYWJcIixcbiAgICAgICAgICAgIHJ1bjogdGhpcy5vYnNpZGlhbi5jcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgICBydW46IHRoaXMubW92ZUxpc3RFbGVtZW50TGVmdCxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0pXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5iZXR0ZXJUYWIgJiYgIXRoaXMuaW1lLmlzSU1FT3BlbmVkKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBtb3ZlTGlzdEVsZW1lbnREb3duQ29tbWFuZCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMucGVyZm9ybU9wZXJhdGlvbi5wZXJmb3JtT3BlcmF0aW9uKFxuICAgICAgKHJvb3QpID0+IG5ldyBNb3ZlRG93bk9wZXJhdGlvbihyb290KSxcbiAgICAgIGVkaXRvclxuICAgICk7XG5cbiAgICByZXR1cm4gc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgbW92ZUxpc3RFbGVtZW50VXBDb21tYW5kID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCB7IHNob3VsZFN0b3BQcm9wYWdhdGlvbiB9ID0gdGhpcy5wZXJmb3JtT3BlcmF0aW9uLnBlcmZvcm1PcGVyYXRpb24oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVVcE9wZXJhdGlvbihyb290KSxcbiAgICAgIGVkaXRvclxuICAgICk7XG5cbiAgICByZXR1cm4gc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgbW92ZUxpc3RFbGVtZW50UmlnaHRDb21tYW5kID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBpZiAodGhpcy5pbWUuaXNJTUVPcGVuZWQoKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMubW92ZUxpc3RFbGVtZW50UmlnaHQoZWRpdG9yKS5zaG91bGRTdG9wUHJvcGFnYXRpb247XG4gIH07XG5cbiAgcHJpdmF0ZSBtb3ZlTGlzdEVsZW1lbnRSaWdodCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMucGVyZm9ybU9wZXJhdGlvbi5wZXJmb3JtT3BlcmF0aW9uKFxuICAgICAgKHJvb3QpID0+XG4gICAgICAgIG5ldyBNb3ZlUmlnaHRPcGVyYXRpb24ocm9vdCwgdGhpcy5vYnNpZGlhbi5nZXREZWZhdWx0SW5kZW50Q2hhcnMoKSksXG4gICAgICBlZGl0b3JcbiAgICApO1xuICB9O1xuXG4gIHByaXZhdGUgbW92ZUxpc3RFbGVtZW50TGVmdENvbW1hbmQgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGlmICh0aGlzLmltZS5pc0lNRU9wZW5lZCgpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5tb3ZlTGlzdEVsZW1lbnRMZWZ0KGVkaXRvcikuc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgbW92ZUxpc3RFbGVtZW50TGVmdCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMucGVyZm9ybU9wZXJhdGlvbi5wZXJmb3JtT3BlcmF0aW9uKFxuICAgICAgKHJvb3QpID0+IG5ldyBNb3ZlTGVmdE9wZXJhdGlvbihyb290KSxcbiAgICAgIGVkaXRvclxuICAgICk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgbWF4UG9zLCBtaW5Qb3MgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgU2VsZWN0QWxsT3BlcmF0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gcm9vdC5nZXRTZWxlY3Rpb25zKClbMF07XG4gICAgY29uc3QgW3Jvb3RTdGFydCwgcm9vdEVuZF0gPSByb290LmdldFJhbmdlKCk7XG5cbiAgICBjb25zdCBzZWxlY3Rpb25Gcm9tID0gbWluUG9zKHNlbGVjdGlvbi5hbmNob3IsIHNlbGVjdGlvbi5oZWFkKTtcbiAgICBjb25zdCBzZWxlY3Rpb25UbyA9IG1heFBvcyhzZWxlY3Rpb24uYW5jaG9yLCBzZWxlY3Rpb24uaGVhZCk7XG5cbiAgICBpZiAoXG4gICAgICBzZWxlY3Rpb25Gcm9tLmxpbmUgPCByb290U3RhcnQubGluZSB8fFxuICAgICAgc2VsZWN0aW9uVG8ubGluZSA+IHJvb3RFbmQubGluZVxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHNlbGVjdGlvbkZyb20ubGluZSA9PT0gcm9vdFN0YXJ0LmxpbmUgJiZcbiAgICAgIHNlbGVjdGlvbkZyb20uY2ggPT09IHJvb3RTdGFydC5jaCAmJlxuICAgICAgc2VsZWN0aW9uVG8ubGluZSA9PT0gcm9vdEVuZC5saW5lICYmXG4gICAgICBzZWxlY3Rpb25Uby5jaCA9PT0gcm9vdEVuZC5jaFxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGNvbnRlbnRTdGFydCA9IGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpO1xuICAgIGNvbnN0IGNvbnRlbnRFbmQgPSBsaXN0LmdldExhc3RMaW5lQ29udGVudEVuZCgpO1xuXG4gICAgaWYgKFxuICAgICAgc2VsZWN0aW9uRnJvbS5saW5lIDwgY29udGVudFN0YXJ0LmxpbmUgfHxcbiAgICAgIHNlbGVjdGlvblRvLmxpbmUgPiBjb250ZW50RW5kLmxpbmVcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGlmIChcbiAgICAgIHNlbGVjdGlvbkZyb20ubGluZSA9PT0gY29udGVudFN0YXJ0LmxpbmUgJiZcbiAgICAgIHNlbGVjdGlvbkZyb20uY2ggPT09IGNvbnRlbnRTdGFydC5jaCAmJlxuICAgICAgc2VsZWN0aW9uVG8ubGluZSA9PT0gY29udGVudEVuZC5saW5lICYmXG4gICAgICBzZWxlY3Rpb25Uby5jaCA9PT0gY29udGVudEVuZC5jaFxuICAgICkge1xuICAgICAgLy8gc2VsZWN0IHdob2xlIGxpc3RcbiAgICAgIHJvb3QucmVwbGFjZVNlbGVjdGlvbnMoW3sgYW5jaG9yOiByb290U3RhcnQsIGhlYWQ6IHJvb3RFbmQgfV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBzZWxlY3Qgd2hvbGUgbGluZVxuICAgICAgcm9vdC5yZXBsYWNlU2VsZWN0aW9ucyhbeyBhbmNob3I6IGNvbnRlbnRTdGFydCwgaGVhZDogY29udGVudEVuZCB9XSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbl8yIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL015RWRpdG9yXCI7XG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4uL2ZlYXR1cmVzL0ZlYXR1cmVcIjtcbmltcG9ydCB7IFNlbGVjdEFsbE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL1NlbGVjdEFsbE9wZXJhdGlvblwiO1xuaW1wb3J0IHsgSU1FU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVTZXJ2aWNlXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQZXJmb3JtT3BlcmF0aW9uU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QZXJmb3JtT3BlcmF0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5leHBvcnQgY2xhc3MgU2VsZWN0QWxsRmVhdHVyZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luXzIsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NTZXJ2aWNlLFxuICAgIHByaXZhdGUgaW1lOiBJTUVTZXJ2aWNlLFxuICAgIHByaXZhdGUgb2JzaWRpYW46IE9ic2lkaWFuU2VydmljZSxcbiAgICBwcml2YXRlIHBlcmZvcm1PcGVyYXRpb246IFBlcmZvcm1PcGVyYXRpb25TZXJ2aWNlXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAge1xuICAgICAgICAgIGtleTogXCJjLWFcIixcbiAgICAgICAgICBtYWM6IFwibS1hXCIsXG4gICAgICAgICAgcnVuOiB0aGlzLm9ic2lkaWFuLmNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5zZWxlY3RBbGwgJiYgIXRoaXMuaW1lLmlzSU1FT3BlbmVkKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLnBlcmZvcm1PcGVyYXRpb24ucGVyZm9ybU9wZXJhdGlvbihcbiAgICAgIChyb290KSA9PiBuZXcgU2VsZWN0QWxsT3BlcmF0aW9uKHJvb3QpLFxuICAgICAgZWRpdG9yXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgUGx1Z2luXzIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHtcbiAgTGlzdExpbmVBY3Rpb24sXG4gIFNldHRpbmdzU2VydmljZSxcbiAgU3RpY2tDdXJzb3IsXG59IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1NlcnZpY2VcIjtcblxuY2xhc3MgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogUGx1Z2luXzIsIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzU2VydmljZSkge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblxuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiSW1wcm92ZSB0aGUgc3R5bGUgb2YgeW91ciBsaXN0c1wiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgIFwiU3R5bGVzIGFyZSBvbmx5IGNvbXBhdGlibGUgd2l0aCBidWlsdC1pbiBPYnNpZGlhbiB0aGVtZXMgYW5kIG1heSBub3QgYmUgY29tcGF0aWJsZSB3aXRoIG90aGVyIHRoZW1lcy5cIlxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLnN0eWxlTGlzdHMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3Muc3R5bGVMaXN0cyA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkRyYXcgdmVydGljYWwgaW5kZW50YXRpb24gbGluZXNcIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5saXN0TGluZXMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3MubGlzdExpbmVzID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiVmVydGljYWwgaW5kZW50YXRpb24gbGluZSBjbGljayBhY3Rpb25cIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgICAgZHJvcGRvd25cbiAgICAgICAgICAuYWRkT3B0aW9ucyh7XG4gICAgICAgICAgICBub25lOiBcIk5vbmVcIixcbiAgICAgICAgICAgIFwiem9vbS1pblwiOiBcIlpvb20gSW5cIixcbiAgICAgICAgICAgIFwidG9nZ2xlLWZvbGRpbmdcIjogXCJUb2dnbGUgRm9sZGluZ1wiLFxuICAgICAgICAgIH0gYXMgeyBba2V5IGluIExpc3RMaW5lQWN0aW9uXTogc3RyaW5nIH0pXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MubGlzdExpbmVBY3Rpb24pXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5saXN0TGluZUFjdGlvbiA9IHZhbHVlIGFzIExpc3RMaW5lQWN0aW9uO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTdGljayB0aGUgY3Vyc29yIHRvIHRoZSBjb250ZW50XCIpXG4gICAgICAuc2V0RGVzYyhcIkRvbid0IGxldCB0aGUgY3Vyc29yIG1vdmUgdG8gdGhlIGJ1bGxldCBwb3NpdGlvbi5cIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgICAgZHJvcGRvd25cbiAgICAgICAgICAuYWRkT3B0aW9ucyh7XG4gICAgICAgICAgICBuZXZlcjogXCJOZXZlclwiLFxuICAgICAgICAgICAgXCJidWxsZXQtb25seVwiOiBcIlN0aWNrIGN1cnNvciBvdXQgb2YgYnVsbGV0c1wiLFxuICAgICAgICAgICAgXCJidWxsZXQtYW5kLWNoZWNrYm94XCI6IFwiU3RpY2sgY3Vyc29yIG91dCBvZiBidWxsZXRzIGFuZCBjaGVja2JveGVzXCIsXG4gICAgICAgICAgfSBhcyB7IFtrZXkgaW4gU3RpY2tDdXJzb3JdOiBzdHJpbmcgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5zdGlja0N1cnNvcilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLnN0aWNrQ3Vyc29yID0gdmFsdWUgYXMgU3RpY2tDdXJzb3I7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkVuaGFuY2UgdGhlIEVudGVyIGtleVwiKVxuICAgICAgLnNldERlc2MoXCJNYWtlIHRoZSBFbnRlciBrZXkgYmVoYXZlIHRoZSBzYW1lIGFzIG90aGVyIG91dGxpbmVycy5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5iZXR0ZXJFbnRlcikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5iZXR0ZXJFbnRlciA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkVuaGFuY2UgdGhlIFRhYiBrZXlcIilcbiAgICAgIC5zZXREZXNjKFwiTWFrZSBUYWIgYW5kIFNoaWZ0LVRhYiBiZWhhdmUgdGhlIHNhbWUgYXMgb3RoZXIgb3V0bGluZXJzLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmJldHRlclRhYikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5iZXR0ZXJUYWIgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJFbmhhbmNlIHRoZSBDdHJsK0Egb3IgQ21kK0EgYmVoYXZpb3JcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIlByZXNzIHRoZSBob3RrZXkgb25jZSB0byBzZWxlY3QgdGhlIGN1cnJlbnQgbGlzdCBpdGVtLiBQcmVzcyB0aGUgaG90a2V5IHR3aWNlIHRvIHNlbGVjdCB0aGUgZW50aXJlIGxpc3QuXCJcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5zZWxlY3RBbGwpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3Muc2VsZWN0QWxsID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRHJhZy1hbmQtRHJvcCAoRXhwZXJpbWVudGFsKVwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmRuZEV4cGVyaW1lbnQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3MuZG5kRXhwZXJpbWVudCA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkRlYnVnIG1vZGVcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIk9wZW4gRGV2VG9vbHMgKENvbW1hbmQrT3B0aW9uK0kgb3IgQ29udHJvbCtTaGlmdCtJKSB0byBjb3B5IHRoZSBkZWJ1ZyBsb2dzLlwiXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MuZGVidWcpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3MuZGVidWcgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NUYWJGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGx1Z2luOiBQbHVnaW5fMiwgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NTZXJ2aWNlKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4uYWRkU2V0dGluZ1RhYihcbiAgICAgIG5ldyBPYnNpZGlhbk91dGxpbmVyUGx1Z2luU2V0dGluZ1RhYihcbiAgICAgICAgdGhpcy5wbHVnaW4uYXBwLFxuICAgICAgICB0aGlzLnBsdWdpbixcbiAgICAgICAgdGhpcy5zZXR0aW5nc1xuICAgICAgKVxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgQ3JlYXRlTm90ZUxpbmVPcGVyYXRpb24gaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVVbmRlckN1cnNvciA9IGxpc3RcbiAgICAgIC5nZXRMaW5lc0luZm8oKVxuICAgICAgLmZpbmQoKGwpID0+IGwuZnJvbS5saW5lID09PSBjdXJzb3IubGluZSk7XG5cbiAgICBpZiAoY3Vyc29yLmNoIDwgbGluZVVuZGVyQ3Vyc29yLmZyb20uY2gpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGlmICghbGlzdC5nZXROb3Rlc0luZGVudCgpKSB7XG4gICAgICBsaXN0LnNldE5vdGVzSW5kZW50KGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkgKyBcIiAgXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKS5yZWR1Y2UoKGFjYywgbGluZSkgPT4ge1xuICAgICAgaWYgKGN1cnNvci5saW5lID09PSBsaW5lLmZyb20ubGluZSkge1xuICAgICAgICBhY2MucHVzaChsaW5lLnRleHQuc2xpY2UoMCwgY3Vyc29yLmNoIC0gbGluZS5mcm9tLmNoKSk7XG4gICAgICAgIGFjYy5wdXNoKGxpbmUudGV4dC5zbGljZShjdXJzb3IuY2ggLSBsaW5lLmZyb20uY2gpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFjYy5wdXNoKGxpbmUudGV4dCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwgW10gYXMgc3RyaW5nW10pO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMpO1xuXG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lICsgMSxcbiAgICAgIGNoOiBsaXN0LmdldE5vdGVzSW5kZW50KCkubGVuZ3RoLFxuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW5fMiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBrZXltYXAgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9NeUVkaXRvclwiO1xuaW1wb3J0IHsgQ3JlYXRlTm90ZUxpbmVPcGVyYXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9DcmVhdGVOb3RlTGluZU9wZXJhdGlvblwiO1xuaW1wb3J0IHsgSU1FU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVTZXJ2aWNlXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNlcnZpY2UgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQZXJmb3JtT3BlcmF0aW9uU2VydmljZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QZXJmb3JtT3BlcmF0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5leHBvcnQgY2xhc3MgU2hpZnRFbnRlclNob3VsZENyZWF0ZU5vdGVGZWF0dXJlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW5fMixcbiAgICBwcml2YXRlIG9ic2lkaWFuOiBPYnNpZGlhblNlcnZpY2UsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NTZXJ2aWNlLFxuICAgIHByaXZhdGUgaW1lOiBJTUVTZXJ2aWNlLFxuICAgIHByaXZhdGUgcGVyZm9ybU9wZXJhdGlvbjogUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcInMtRW50ZXJcIixcbiAgICAgICAgICBydW46IHRoaXMub2JzaWRpYW4uY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSlcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNoZWNrID0gKCkgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldHRpbmdzLmJldHRlckVudGVyICYmICF0aGlzLmltZS5pc0lNRU9wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5wZXJmb3JtT3BlcmF0aW9uLnBlcmZvcm1PcGVyYXRpb24oXG4gICAgICAocm9vdCkgPT4gbmV3IENyZWF0ZU5vdGVMaW5lT3BlcmF0aW9uKHJvb3QpLFxuICAgICAgZWRpdG9yXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL015RWRpdG9yXCI7XG5pbXBvcnQgeyBMaXN0LCBQb3NpdGlvbiwgUm9vdCwgaXNSYW5nZXNJbnRlcnNlY3RzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIEFwcGx5Q2hhbmdlc1NlcnZpY2Uge1xuICBhcHBseUNoYW5nZXMoZWRpdG9yOiBNeUVkaXRvciwgcHJldlJvb3Q6IFJvb3QsIG5ld1Jvb3Q6IFJvb3QpIHtcbiAgICBjb25zdCBjaGFuZ2VzID0gdGhpcy5jYWxjdWxhdGVDaGFuZ2VzKGVkaXRvciwgcHJldlJvb3QsIG5ld1Jvb3QpO1xuICAgIGlmIChjaGFuZ2VzKSB7XG4gICAgICBjb25zdCB7IHJlcGxhY2VtZW50LCBjaGFuZ2VGcm9tLCBjaGFuZ2VUbyB9ID0gY2hhbmdlcztcblxuICAgICAgY29uc3QgeyB1bmZvbGQsIGZvbGQgfSA9IHRoaXMuY2FsY3VsYXRlRm9sZGluZ09wcmF0aW9ucyhcbiAgICAgICAgcHJldlJvb3QsXG4gICAgICAgIG5ld1Jvb3QsXG4gICAgICAgIGNoYW5nZUZyb20sXG4gICAgICAgIGNoYW5nZVRvXG4gICAgICApO1xuXG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgdW5mb2xkKSB7XG4gICAgICAgIGVkaXRvci51bmZvbGQobGluZSk7XG4gICAgICB9XG5cbiAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UocmVwbGFjZW1lbnQsIGNoYW5nZUZyb20sIGNoYW5nZVRvKTtcblxuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGZvbGQpIHtcbiAgICAgICAgZWRpdG9yLmZvbGQobGluZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZWRpdG9yLnNldFNlbGVjdGlvbnMobmV3Um9vdC5nZXRTZWxlY3Rpb25zKCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVDaGFuZ2VzKGVkaXRvcjogTXlFZGl0b3IsIHByZXZSb290OiBSb290LCBuZXdSb290OiBSb290KSB7XG4gICAgY29uc3Qgcm9vdFJhbmdlID0gcHJldlJvb3QuZ2V0UmFuZ2UoKTtcbiAgICBjb25zdCBvbGRTdHJpbmcgPSBlZGl0b3IuZ2V0UmFuZ2Uocm9vdFJhbmdlWzBdLCByb290UmFuZ2VbMV0pO1xuICAgIGNvbnN0IG5ld1N0cmluZyA9IG5ld1Jvb3QucHJpbnQoKTtcblxuICAgIGNvbnN0IGNoYW5nZUZyb20gPSB7IC4uLnJvb3RSYW5nZVswXSB9O1xuICAgIGNvbnN0IGNoYW5nZVRvID0geyAuLi5yb290UmFuZ2VbMV0gfTtcbiAgICBsZXQgb2xkVG1wID0gb2xkU3RyaW5nO1xuICAgIGxldCBuZXdUbXAgPSBuZXdTdHJpbmc7XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IG5sSW5kZXggPSBvbGRUbXAubGFzdEluZGV4T2YoXCJcXG5cIik7XG5cbiAgICAgIGlmIChubEluZGV4IDwgMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb2xkTGluZSA9IG9sZFRtcC5zbGljZShubEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0xpbmUgPSBuZXdUbXAuc2xpY2UoLW9sZExpbmUubGVuZ3RoKTtcblxuICAgICAgaWYgKG9sZExpbmUgIT09IG5ld0xpbmUpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIG9sZFRtcCA9IG9sZFRtcC5zbGljZSgwLCAtb2xkTGluZS5sZW5ndGgpO1xuICAgICAgbmV3VG1wID0gbmV3VG1wLnNsaWNlKDAsIC1vbGRMaW5lLmxlbmd0aCk7XG4gICAgICBjb25zdCBubEluZGV4MiA9IG9sZFRtcC5sYXN0SW5kZXhPZihcIlxcblwiKTtcbiAgICAgIGNoYW5nZVRvLmNoID1cbiAgICAgICAgbmxJbmRleDIgPj0gMCA/IG9sZFRtcC5sZW5ndGggLSBubEluZGV4MiAtIDEgOiBvbGRUbXAubGVuZ3RoO1xuICAgICAgY2hhbmdlVG8ubGluZS0tO1xuICAgIH1cblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgbmxJbmRleCA9IG9sZFRtcC5pbmRleE9mKFwiXFxuXCIpO1xuXG4gICAgICBpZiAobmxJbmRleCA8IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9sZExpbmUgPSBvbGRUbXAuc2xpY2UoMCwgbmxJbmRleCArIDEpO1xuICAgICAgY29uc3QgbmV3TGluZSA9IG5ld1RtcC5zbGljZSgwLCBvbGRMaW5lLmxlbmd0aCk7XG5cbiAgICAgIGlmIChvbGRMaW5lICE9PSBuZXdMaW5lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjaGFuZ2VGcm9tLmxpbmUrKztcbiAgICAgIG9sZFRtcCA9IG9sZFRtcC5zbGljZShvbGRMaW5lLmxlbmd0aCk7XG4gICAgICBuZXdUbXAgPSBuZXdUbXAuc2xpY2Uob2xkTGluZS5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChvbGRUbXAgPT09IG5ld1RtcCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlcGxhY2VtZW50OiBuZXdUbXAsXG4gICAgICBjaGFuZ2VGcm9tLFxuICAgICAgY2hhbmdlVG8sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlRm9sZGluZ09wcmF0aW9ucyhcbiAgICBwcmV2Um9vdDogUm9vdCxcbiAgICBuZXdSb290OiBSb290LFxuICAgIGNoYW5nZUZyb206IFBvc2l0aW9uLFxuICAgIGNoYW5nZVRvOiBQb3NpdGlvblxuICApIHtcbiAgICBjb25zdCBjaGFuZ2VkUmFuZ2U6IFtQb3NpdGlvbiwgUG9zaXRpb25dID0gW2NoYW5nZUZyb20sIGNoYW5nZVRvXTtcblxuICAgIGNvbnN0IHByZXZMaXN0cyA9IGdldEFsbENoaWxkcmVuKHByZXZSb290KTtcbiAgICBjb25zdCBuZXdMaXN0cyA9IGdldEFsbENoaWxkcmVuKG5ld1Jvb3QpO1xuXG4gICAgY29uc3QgdW5mb2xkOiBudW1iZXJbXSA9IFtdO1xuICAgIGNvbnN0IGZvbGQ6IG51bWJlcltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHByZXZMaXN0IG9mIHByZXZMaXN0cy52YWx1ZXMoKSkge1xuICAgICAgaWYgKCFwcmV2TGlzdC5pc0ZvbGRSb290KCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5ld0xpc3QgPSBuZXdMaXN0cy5nZXQocHJldkxpc3QuZ2V0SUQoKSk7XG5cbiAgICAgIGlmICghbmV3TGlzdCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJldkxpc3RSYW5nZTogW1Bvc2l0aW9uLCBQb3NpdGlvbl0gPSBbXG4gICAgICAgIHByZXZMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLFxuICAgICAgICBwcmV2TGlzdC5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKSxcbiAgICAgIF07XG5cbiAgICAgIGlmIChpc1Jhbmdlc0ludGVyc2VjdHMocHJldkxpc3RSYW5nZSwgY2hhbmdlZFJhbmdlKSkge1xuICAgICAgICB1bmZvbGQucHVzaChwcmV2TGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgICAgICAgZm9sZC5wdXNoKG5ld0xpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdW5mb2xkLnNvcnQoKGEsIGIpID0+IGIgLSBhKTtcbiAgICBmb2xkLnNvcnQoKGEsIGIpID0+IGIgLSBhKTtcblxuICAgIHJldHVybiB7IHVuZm9sZCwgZm9sZCB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEFsbENoaWxkcmVuUmVkdWNlRm4oYWNjOiBNYXA8bnVtYmVyLCBMaXN0PiwgY2hpbGQ6IExpc3QpIHtcbiAgYWNjLnNldChjaGlsZC5nZXRJRCgpLCBjaGlsZCk7XG4gIGNoaWxkLmdldENoaWxkcmVuKCkucmVkdWNlKGdldEFsbENoaWxkcmVuUmVkdWNlRm4sIGFjYyk7XG5cbiAgcmV0dXJuIGFjYztcbn1cblxuZnVuY3Rpb24gZ2V0QWxsQ2hpbGRyZW4ocm9vdDogUm9vdCk6IE1hcDxudW1iZXIsIExpc3Q+IHtcbiAgcmV0dXJuIHJvb3QuZ2V0Q2hpbGRyZW4oKS5yZWR1Y2UoZ2V0QWxsQ2hpbGRyZW5SZWR1Y2VGbiwgbmV3IE1hcCgpKTtcbn1cbiIsImltcG9ydCB7IFBsYXRmb3JtIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBjbGFzcyBJTUVTZXJ2aWNlIHtcbiAgcHJpdmF0ZSBjb21wb3NpdGlvbiA9IGZhbHNlO1xuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNvbXBvc2l0aW9uc3RhcnRcIiwgdGhpcy5vbkNvbXBvc2l0aW9uU3RhcnQpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbmVuZFwiLCB0aGlzLm9uQ29tcG9zaXRpb25FbmQpO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbmVuZFwiLCB0aGlzLm9uQ29tcG9zaXRpb25FbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbnN0YXJ0XCIsIHRoaXMub25Db21wb3NpdGlvblN0YXJ0KTtcbiAgfVxuXG4gIGlzSU1FT3BlbmVkKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBvc2l0aW9uICYmIFBsYXRmb3JtLmlzRGVza3RvcDtcbiAgfVxuXG4gIHByaXZhdGUgb25Db21wb3NpdGlvblN0YXJ0ID0gKCkgPT4ge1xuICAgIHRoaXMuY29tcG9zaXRpb24gPSB0cnVlO1xuICB9O1xuXG4gIHByaXZhdGUgb25Db21wb3NpdGlvbkVuZCA9ICgpID0+IHtcbiAgICB0aGlzLmNvbXBvc2l0aW9uID0gZmFsc2U7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBTZXR0aW5nc1NlcnZpY2UgfSBmcm9tIFwiLi9TZXR0aW5nc1NlcnZpY2VcIjtcblxuZXhwb3J0IGNsYXNzIExvZ2dlclNlcnZpY2Uge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5nc1NlcnZpY2UpIHt9XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgbG9nKG1ldGhvZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSkge1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5kZWJ1Zykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUuaW5mbyhtZXRob2QsIC4uLmFyZ3MpO1xuICB9XG5cbiAgYmluZChtZXRob2Q6IHN0cmluZykge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgcmV0dXJuICguLi5hcmdzOiBhbnlbXSkgPT4gdGhpcy5sb2cobWV0aG9kLCAuLi5hcmdzKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQXBwLCBFZGl0b3IsIGVkaXRvckluZm9GaWVsZCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBFZGl0b3JTdGF0ZSB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgRWRpdG9yVmlldyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL015RWRpdG9yXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2JzaWRpYW5UYWJzU2V0dGluZ3Mge1xuICB1c2VUYWI6IGJvb2xlYW47XG4gIHRhYlNpemU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPYnNpZGlhbkZvbGRTZXR0aW5ncyB7XG4gIGZvbGRJbmRlbnQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBPYnNpZGlhblNlcnZpY2Uge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFwcDogQXBwKSB7fVxuXG4gIGlzTGVnYWN5RWRpdG9yRW5hYmxlZCgpIHtcbiAgICBjb25zdCBjb25maWc6IHsgbGVnYWN5RWRpdG9yOiBib29sZWFuIH0gPSB7XG4gICAgICBsZWdhY3lFZGl0b3I6IGZhbHNlLFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIC4uLih0aGlzLmFwcC52YXVsdCBhcyBhbnkpLmNvbmZpZyxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbmZpZy5sZWdhY3lFZGl0b3I7XG4gIH1cblxuICBpc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSB7XG4gICAgY29uc3QgY29uZmlnOiB7IGNzc1RoZW1lOiBzdHJpbmcgfSA9IHtcbiAgICAgIGNzc1RoZW1lOiBcIlwiLFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIC4uLih0aGlzLmFwcC52YXVsdCBhcyBhbnkpLmNvbmZpZyxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbmZpZy5jc3NUaGVtZSA9PT0gXCJcIjtcbiAgfVxuXG4gIGdldE9ic2lkaWFuVGFic1NldHRpbmdzKCk6IE9ic2lkaWFuVGFic1NldHRpbmdzIHtcbiAgICByZXR1cm4ge1xuICAgICAgdXNlVGFiOiB0cnVlLFxuICAgICAgdGFiU2l6ZTogNCxcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAuLi4odGhpcy5hcHAudmF1bHQgYXMgYW55KS5jb25maWcsXG4gICAgfTtcbiAgfVxuXG4gIGdldE9ic2lkaWFuRm9sZFNldHRpbmdzKCk6IE9ic2lkaWFuRm9sZFNldHRpbmdzIHtcbiAgICByZXR1cm4ge1xuICAgICAgZm9sZEluZGVudDogdHJ1ZSxcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAuLi4odGhpcy5hcHAudmF1bHQgYXMgYW55KS5jb25maWcsXG4gICAgfTtcbiAgfVxuXG4gIGdldERlZmF1bHRJbmRlbnRDaGFycygpIHtcbiAgICBjb25zdCB7IHVzZVRhYiwgdGFiU2l6ZSB9ID0gdGhpcy5nZXRPYnNpZGlhblRhYnNTZXR0aW5ncygpO1xuXG4gICAgcmV0dXJuIHVzZVRhYiA/IFwiXFx0XCIgOiBuZXcgQXJyYXkodGFiU2l6ZSkuZmlsbChcIiBcIikuam9pbihcIlwiKTtcbiAgfVxuXG4gIGdldEVkaXRvckZyb21TdGF0ZShzdGF0ZTogRWRpdG9yU3RhdGUpIHtcbiAgICByZXR1cm4gbmV3IE15RWRpdG9yKHN0YXRlLmZpZWxkKGVkaXRvckluZm9GaWVsZCkuZWRpdG9yKTtcbiAgfVxuXG4gIGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKGNvbmZpZzoge1xuICAgIGNoZWNrPzogKGVkaXRvcjogTXlFZGl0b3IpID0+IGJvb2xlYW47XG4gICAgcnVuOiAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgICAgc2hvdWxkVXBkYXRlOiBib29sZWFuO1xuICAgICAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uOiBib29sZWFuO1xuICAgIH07XG4gIH0pIHtcbiAgICBjb25zdCBjaGVjayA9IGNvbmZpZy5jaGVjayB8fCAoKCkgPT4gdHJ1ZSk7XG4gICAgY29uc3QgeyBydW4gfSA9IGNvbmZpZztcblxuICAgIHJldHVybiAodmlldzogRWRpdG9yVmlldyk6IGJvb2xlYW4gPT4ge1xuICAgICAgY29uc3QgZWRpdG9yID0gdGhpcy5nZXRFZGl0b3JGcm9tU3RhdGUodmlldy5zdGF0ZSk7XG5cbiAgICAgIGlmICghY2hlY2soZWRpdG9yKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgc2hvdWxkVXBkYXRlLCBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHJ1bihlZGl0b3IpO1xuXG4gICAgICByZXR1cm4gc2hvdWxkVXBkYXRlIHx8IHNob3VsZFN0b3BQcm9wYWdhdGlvbjtcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlRWRpdG9yQ2FsbGJhY2soY2I6IChlZGl0b3I6IE15RWRpdG9yKSA9PiBib29sZWFuKSB7XG4gICAgcmV0dXJuIChlZGl0b3I6IEVkaXRvcikgPT4ge1xuICAgICAgY29uc3QgbXlFZGl0b3IgPSBuZXcgTXlFZGl0b3IoZWRpdG9yKTtcbiAgICAgIGNvbnN0IHNob3VsZFN0b3BQcm9wYWdhdGlvbiA9IGNiKG15RWRpdG9yKTtcblxuICAgICAgaWYgKFxuICAgICAgICAhc2hvdWxkU3RvcFByb3BhZ2F0aW9uICYmXG4gICAgICAgIHdpbmRvdy5ldmVudCAmJlxuICAgICAgICB3aW5kb3cuZXZlbnQudHlwZSA9PT0gXCJrZXlkb3duXCJcbiAgICAgICkge1xuICAgICAgICBteUVkaXRvci50cmlnZ2VyT25LZXlEb3duKHdpbmRvdy5ldmVudCBhcyBLZXlib2FyZEV2ZW50KTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG59XG4iLCJpbXBvcnQgeyBTZXR0aW5nc1NlcnZpY2UgfSBmcm9tIFwiLi9TZXR0aW5nc1NlcnZpY2VcIjtcblxuaW1wb3J0IHsgTGlzdCwgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5pbXBvcnQgeyBMb2dnZXJTZXJ2aWNlIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0xvZ2dlclNlcnZpY2VcIjtcbmltcG9ydCB7IGNoZWNrYm94UmUgfSBmcm9tIFwiLi4vdXRpbHMvY2hlY2tib3hSZVwiO1xuXG5jb25zdCBidWxsZXRTaWduUmUgPSBgKD86Wy0qK118XFxcXGQrXFxcXC4pYDtcbmNvbnN0IG9wdGlvbmFsQ2hlY2tib3hSZSA9IGAoPzoke2NoZWNrYm94UmV9KT9gO1xuXG5jb25zdCBsaXN0SXRlbVdpdGhvdXRTcGFjZXNSZSA9IG5ldyBSZWdFeHAoYF4ke2J1bGxldFNpZ25SZX0oIHxcXHQpYCk7XG5jb25zdCBsaXN0SXRlbVJlID0gbmV3IFJlZ0V4cChgXlsgXFx0XSoke2J1bGxldFNpZ25SZX0oIHxcXHQpYCk7XG5jb25zdCBzdHJpbmdXaXRoU3BhY2VzUmUgPSBuZXcgUmVnRXhwKGBeWyBcXHRdK2ApO1xuY29uc3QgcGFyc2VMaXN0SXRlbVJlID0gbmV3IFJlZ0V4cChcbiAgYF4oWyBcXHRdKikoJHtidWxsZXRTaWduUmV9KSggfFxcdCkoJHtvcHRpb25hbENoZWNrYm94UmV9KSguKikkYFxuKTtcblxuZXhwb3J0IGludGVyZmFjZSBSZWFkZXJQb3NpdGlvbiB7XG4gIGxpbmU6IG51bWJlcjtcbiAgY2g6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWFkZXJTZWxlY3Rpb24ge1xuICBhbmNob3I6IFJlYWRlclBvc2l0aW9uO1xuICBoZWFkOiBSZWFkZXJQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWFkZXIge1xuICBnZXRDdXJzb3IoKTogUmVhZGVyUG9zaXRpb247XG4gIGdldExpbmUobjogbnVtYmVyKTogc3RyaW5nO1xuICBsYXN0TGluZSgpOiBudW1iZXI7XG4gIGxpc3RTZWxlY3Rpb25zKCk6IFJlYWRlclNlbGVjdGlvbltdO1xuICBnZXRBbGxGb2xkZWRMaW5lcygpOiBudW1iZXJbXTtcbn1cblxuaW50ZXJmYWNlIFBhcnNlTGlzdExpc3Qge1xuICBnZXRGaXJzdExpbmVJbmRlbnQoKTogc3RyaW5nO1xuICBzZXROb3Rlc0luZGVudChub3Rlc0luZGVudDogc3RyaW5nKTogdm9pZDtcbiAgZ2V0Tm90ZXNJbmRlbnQoKTogc3RyaW5nIHwgbnVsbDtcbiAgYWRkTGluZSh0ZXh0OiBzdHJpbmcpOiB2b2lkO1xuICBnZXRQYXJlbnQoKTogUGFyc2VMaXN0TGlzdCB8IG51bGw7XG4gIGFkZEFmdGVyQWxsKGxpc3Q6IFBhcnNlTGlzdExpc3QpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VyU2VydmljZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXJTZXJ2aWNlLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzU2VydmljZVxuICApIHt9XG5cbiAgcGFyc2VSYW5nZShlZGl0b3I6IFJlYWRlciwgZnJvbUxpbmUgPSAwLCB0b0xpbmUgPSBlZGl0b3IubGFzdExpbmUoKSk6IFJvb3RbXSB7XG4gICAgY29uc3QgbGlzdHM6IFJvb3RbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IGZyb21MaW5lOyBpIDw9IHRvTGluZTsgaSsrKSB7XG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUoaSk7XG5cbiAgICAgIGlmIChpID09PSBmcm9tTGluZSB8fCB0aGlzLmlzTGlzdEl0ZW0obGluZSkpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMucGFyc2VXaXRoTGltaXRzKGVkaXRvciwgaSwgZnJvbUxpbmUsIHRvTGluZSk7XG5cbiAgICAgICAgaWYgKGxpc3QpIHtcbiAgICAgICAgICBsaXN0cy5wdXNoKGxpc3QpO1xuICAgICAgICAgIGkgPSBsaXN0LmdldFJhbmdlKClbMV0ubGluZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaXN0cztcbiAgfVxuXG4gIHBhcnNlKGVkaXRvcjogUmVhZGVyLCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCkpOiBSb290IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VXaXRoTGltaXRzKGVkaXRvciwgY3Vyc29yLmxpbmUsIDAsIGVkaXRvci5sYXN0TGluZSgpKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VXaXRoTGltaXRzKFxuICAgIGVkaXRvcjogUmVhZGVyLFxuICAgIHBhcnNpbmdTdGFydExpbmU6IG51bWJlcixcbiAgICBsaW1pdEZyb206IG51bWJlcixcbiAgICBsaW1pdFRvOiBudW1iZXJcbiAgKTogUm9vdCB8IG51bGwge1xuICAgIGNvbnN0IGQgPSB0aGlzLmxvZ2dlci5iaW5kKFwicGFyc2VMaXN0XCIpO1xuICAgIGNvbnN0IGVycm9yID0gKG1zZzogc3RyaW5nKTogbnVsbCA9PiB7XG4gICAgICBkKG1zZyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKHBhcnNpbmdTdGFydExpbmUpO1xuXG4gICAgbGV0IGxpc3RMb29raW5nUG9zOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgIGlmICh0aGlzLmlzTGlzdEl0ZW0obGluZSkpIHtcbiAgICAgIGxpc3RMb29raW5nUG9zID0gcGFyc2luZ1N0YXJ0TGluZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgbGV0IGxpc3RMb29raW5nUG9zU2VhcmNoID0gcGFyc2luZ1N0YXJ0TGluZSAtIDE7XG4gICAgICB3aGlsZSAobGlzdExvb2tpbmdQb3NTZWFyY2ggPj0gMCkge1xuICAgICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGlzdExvb2tpbmdQb3NTZWFyY2gpO1xuICAgICAgICBpZiAodGhpcy5pc0xpc3RJdGVtKGxpbmUpKSB7XG4gICAgICAgICAgbGlzdExvb2tpbmdQb3MgPSBsaXN0TG9va2luZ1Bvc1NlYXJjaDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgICBsaXN0TG9va2luZ1Bvc1NlYXJjaC0tO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxpc3RMb29raW5nUG9zID09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBsaXN0U3RhcnRMaW5lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbGlzdFN0YXJ0TGluZUxvb2t1cCA9IGxpc3RMb29raW5nUG9zO1xuICAgIHdoaWxlIChsaXN0U3RhcnRMaW5lTG9va3VwID49IDApIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0U3RhcnRMaW5lTG9va3VwKTtcbiAgICAgIGlmICghdGhpcy5pc0xpc3RJdGVtKGxpbmUpICYmICF0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0xpc3RJdGVtV2l0aG91dFNwYWNlcyhsaW5lKSkge1xuICAgICAgICBsaXN0U3RhcnRMaW5lID0gbGlzdFN0YXJ0TGluZUxvb2t1cDtcbiAgICAgICAgaWYgKGxpc3RTdGFydExpbmVMb29rdXAgPD0gbGltaXRGcm9tKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpc3RTdGFydExpbmVMb29rdXAtLTtcbiAgICB9XG5cbiAgICBpZiAobGlzdFN0YXJ0TGluZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGxpc3RFbmRMaW5lID0gbGlzdExvb2tpbmdQb3M7XG4gICAgbGV0IGxpc3RFbmRMaW5lTG9va3VwID0gbGlzdExvb2tpbmdQb3M7XG4gICAgd2hpbGUgKGxpc3RFbmRMaW5lTG9va3VwIDw9IGVkaXRvci5sYXN0TGluZSgpKSB7XG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGlzdEVuZExpbmVMb29rdXApO1xuICAgICAgaWYgKCF0aGlzLmlzTGlzdEl0ZW0obGluZSkgJiYgIXRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5pc0VtcHR5TGluZShsaW5lKSkge1xuICAgICAgICBsaXN0RW5kTGluZSA9IGxpc3RFbmRMaW5lTG9va3VwO1xuICAgICAgfVxuICAgICAgaWYgKGxpc3RFbmRMaW5lTG9va3VwID49IGxpbWl0VG8pIHtcbiAgICAgICAgbGlzdEVuZExpbmUgPSBsaW1pdFRvO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGxpc3RFbmRMaW5lTG9va3VwKys7XG4gICAgfVxuXG4gICAgaWYgKGxpc3RTdGFydExpbmUgPiBwYXJzaW5nU3RhcnRMaW5lIHx8IGxpc3RFbmRMaW5lIDwgcGFyc2luZ1N0YXJ0TGluZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgcm9vdCA9IG5ldyBSb290KFxuICAgICAgeyBsaW5lOiBsaXN0U3RhcnRMaW5lLCBjaDogMCB9LFxuICAgICAgeyBsaW5lOiBsaXN0RW5kTGluZSwgY2g6IGVkaXRvci5nZXRMaW5lKGxpc3RFbmRMaW5lKS5sZW5ndGggfSxcbiAgICAgIGVkaXRvci5saXN0U2VsZWN0aW9ucygpLm1hcCgocikgPT4gKHtcbiAgICAgICAgYW5jaG9yOiB7IGxpbmU6IHIuYW5jaG9yLmxpbmUsIGNoOiByLmFuY2hvci5jaCB9LFxuICAgICAgICBoZWFkOiB7IGxpbmU6IHIuaGVhZC5saW5lLCBjaDogci5oZWFkLmNoIH0sXG4gICAgICB9KSlcbiAgICApO1xuXG4gICAgbGV0IGN1cnJlbnRQYXJlbnQ6IFBhcnNlTGlzdExpc3QgPSByb290LmdldFJvb3RMaXN0KCk7XG4gICAgbGV0IGN1cnJlbnRMaXN0OiBQYXJzZUxpc3RMaXN0IHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGN1cnJlbnRJbmRlbnQgPSBcIlwiO1xuXG4gICAgY29uc3QgZm9sZGVkTGluZXMgPSBlZGl0b3IuZ2V0QWxsRm9sZGVkTGluZXMoKTtcblxuICAgIGZvciAobGV0IGwgPSBsaXN0U3RhcnRMaW5lOyBsIDw9IGxpc3RFbmRMaW5lOyBsKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsKTtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBwYXJzZUxpc3RJdGVtUmUuZXhlYyhsaW5lKTtcblxuICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgY29uc3QgWywgaW5kZW50LCBidWxsZXQsIHNwYWNlQWZ0ZXJCdWxsZXRdID0gbWF0Y2hlcztcbiAgICAgICAgbGV0IFssICwgLCAsIG9wdGlvbmFsQ2hlY2tib3gsIGNvbnRlbnRdID0gbWF0Y2hlcztcblxuICAgICAgICBjb250ZW50ID0gb3B0aW9uYWxDaGVja2JveCArIGNvbnRlbnQ7XG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLnN0aWNrQ3Vyc29yICE9IFwiYnVsbGV0LWFuZC1jaGVja2JveFwiKSB7XG4gICAgICAgICAgb3B0aW9uYWxDaGVja2JveCA9IFwiXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb21wYXJlTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEluZGVudC5sZW5ndGgsIGluZGVudC5sZW5ndGgpO1xuICAgICAgICBjb25zdCBpbmRlbnRTbGljZSA9IGluZGVudC5zbGljZSgwLCBjb21wYXJlTGVuZ3RoKTtcbiAgICAgICAgY29uc3QgY3VycmVudEluZGVudFNsaWNlID0gY3VycmVudEluZGVudC5zbGljZSgwLCBjb21wYXJlTGVuZ3RoKTtcblxuICAgICAgICBpZiAoaW5kZW50U2xpY2UgIT09IGN1cnJlbnRJbmRlbnRTbGljZSkge1xuICAgICAgICAgIGNvbnN0IGV4cGVjdGVkID0gY3VycmVudEluZGVudFNsaWNlXG4gICAgICAgICAgICAucmVwbGFjZSgvIC9nLCBcIlNcIilcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgXCJUXCIpO1xuICAgICAgICAgIGNvbnN0IGdvdCA9IGluZGVudFNsaWNlLnJlcGxhY2UoLyAvZywgXCJTXCIpLnJlcGxhY2UoL1xcdC9nLCBcIlRcIik7XG5cbiAgICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgICBgVW5hYmxlIHRvIHBhcnNlIGxpc3Q6IGV4cGVjdGVkIGluZGVudCBcIiR7ZXhwZWN0ZWR9XCIsIGdvdCBcIiR7Z290fVwiYFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5kZW50Lmxlbmd0aCA+IGN1cnJlbnRJbmRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgY3VycmVudFBhcmVudCA9IGN1cnJlbnRMaXN0O1xuICAgICAgICAgIGN1cnJlbnRJbmRlbnQgPSBpbmRlbnQ7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5kZW50Lmxlbmd0aCA8IGN1cnJlbnRJbmRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgd2hpbGUgKFxuICAgICAgICAgICAgY3VycmVudFBhcmVudC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGggPj0gaW5kZW50Lmxlbmd0aCAmJlxuICAgICAgICAgICAgY3VycmVudFBhcmVudC5nZXRQYXJlbnQoKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgY3VycmVudFBhcmVudCA9IGN1cnJlbnRQYXJlbnQuZ2V0UGFyZW50KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRJbmRlbnQgPSBpbmRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmb2xkUm9vdCA9IGZvbGRlZExpbmVzLmluY2x1ZGVzKGwpO1xuXG4gICAgICAgIGN1cnJlbnRMaXN0ID0gbmV3IExpc3QoXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICBpbmRlbnQsXG4gICAgICAgICAgYnVsbGV0LFxuICAgICAgICAgIG9wdGlvbmFsQ2hlY2tib3gsXG4gICAgICAgICAgc3BhY2VBZnRlckJ1bGxldCxcbiAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgIGZvbGRSb290XG4gICAgICAgICk7XG4gICAgICAgIGN1cnJlbnRQYXJlbnQuYWRkQWZ0ZXJBbGwoY3VycmVudExpc3QpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgaWYgKCFjdXJyZW50TGlzdCkge1xuICAgICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICAgIGBVbmFibGUgdG8gcGFyc2UgbGlzdDogZXhwZWN0ZWQgbGlzdCBpdGVtLCBnb3QgZW1wdHkgbGluZWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5kZW50VG9DaGVjayA9IGN1cnJlbnRMaXN0LmdldE5vdGVzSW5kZW50KCkgfHwgY3VycmVudEluZGVudDtcblxuICAgICAgICBpZiAobGluZS5pbmRleE9mKGluZGVudFRvQ2hlY2spICE9PSAwKSB7XG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWQgPSBpbmRlbnRUb0NoZWNrLnJlcGxhY2UoLyAvZywgXCJTXCIpLnJlcGxhY2UoL1xcdC9nLCBcIlRcIik7XG4gICAgICAgICAgY29uc3QgZ290ID0gbGluZVxuICAgICAgICAgICAgLm1hdGNoKC9eWyBcXHRdKi8pWzBdXG4gICAgICAgICAgICAucmVwbGFjZSgvIC9nLCBcIlNcIilcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgXCJUXCIpO1xuXG4gICAgICAgICAgcmV0dXJuIGVycm9yKFxuICAgICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBpbmRlbnQgXCIke2V4cGVjdGVkfVwiLCBnb3QgXCIke2dvdH1cImBcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjdXJyZW50TGlzdC5nZXROb3Rlc0luZGVudCgpKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGxpbmUubWF0Y2goL15bIFxcdF0rLyk7XG5cbiAgICAgICAgICBpZiAoIW1hdGNoZXMgfHwgbWF0Y2hlc1swXS5sZW5ndGggPD0gY3VycmVudEluZGVudC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmICgvXlxccyskLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgICAgIGBVbmFibGUgdG8gcGFyc2UgbGlzdDogZXhwZWN0ZWQgc29tZSBpbmRlbnQsIGdvdCBubyBpbmRlbnRgXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGN1cnJlbnRMaXN0LnNldE5vdGVzSW5kZW50KG1hdGNoZXNbMF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VycmVudExpc3QuYWRkTGluZShsaW5lLnNsaWNlKGN1cnJlbnRMaXN0LmdldE5vdGVzSW5kZW50KCkubGVuZ3RoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBsaXN0IGl0ZW0gb3Igbm90ZSwgZ290IFwiJHtsaW5lfVwiYFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByb290O1xuICB9XG5cbiAgcHJpdmF0ZSBpc0VtcHR5TGluZShsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGluZS5sZW5ndGggPT09IDA7XG4gIH1cblxuICBwcml2YXRlIGlzTGluZVdpdGhJbmRlbnQobGluZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZ1dpdGhTcGFjZXNSZS50ZXN0KGxpbmUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xpc3RJdGVtKGxpbmU6IHN0cmluZykge1xuICAgIHJldHVybiBsaXN0SXRlbVJlLnRlc3QobGluZSk7XG4gIH1cblxuICBwcml2YXRlIGlzTGlzdEl0ZW1XaXRob3V0U3BhY2VzKGxpbmU6IHN0cmluZykge1xuICAgIHJldHVybiBsaXN0SXRlbVdpdGhvdXRTcGFjZXNSZS50ZXN0KGxpbmUpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBBcHBseUNoYW5nZXNTZXJ2aWNlIH0gZnJvbSBcIi4vQXBwbHlDaGFuZ2VzU2VydmljZVwiO1xuaW1wb3J0IHsgUGFyc2VyU2VydmljZSB9IGZyb20gXCIuL1BhcnNlclNlcnZpY2VcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vTXlFZGl0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL09wZXJhdGlvblwiO1xuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBQZXJmb3JtT3BlcmF0aW9uU2VydmljZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXJTZXJ2aWNlLFxuICAgIHByaXZhdGUgYXBwbHlDaGFuZ2VzOiBBcHBseUNoYW5nZXNTZXJ2aWNlXG4gICkge31cblxuICBldmFsT3BlcmF0aW9uKHJvb3Q6IFJvb3QsIG9wOiBPcGVyYXRpb24sIGVkaXRvcjogTXlFZGl0b3IpIHtcbiAgICBjb25zdCBwcmV2Um9vdCA9IHJvb3QuY2xvbmUoKTtcblxuICAgIG9wLnBlcmZvcm0oKTtcblxuICAgIGlmIChvcC5zaG91bGRVcGRhdGUoKSkge1xuICAgICAgdGhpcy5hcHBseUNoYW5nZXMuYXBwbHlDaGFuZ2VzKGVkaXRvciwgcHJldlJvb3QsIHJvb3QpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzaG91bGRVcGRhdGU6IG9wLnNob3VsZFVwZGF0ZSgpLFxuICAgICAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uOiBvcC5zaG91bGRTdG9wUHJvcGFnYXRpb24oKSxcbiAgICB9O1xuICB9XG5cbiAgcGVyZm9ybU9wZXJhdGlvbihcbiAgICBjYjogKHJvb3Q6IFJvb3QpID0+IE9wZXJhdGlvbixcbiAgICBlZGl0b3I6IE15RWRpdG9yLFxuICAgIGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKVxuICApIHtcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yLCBjdXJzb3IpO1xuXG4gICAgaWYgKCFyb290KSB7XG4gICAgICByZXR1cm4geyBzaG91bGRVcGRhdGU6IGZhbHNlLCBzaG91bGRTdG9wUHJvcGFnYXRpb246IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgb3AgPSBjYihyb290KTtcblxuICAgIHJldHVybiB0aGlzLmV2YWxPcGVyYXRpb24ocm9vdCwgb3AsIGVkaXRvcik7XG4gIH1cbn1cbiIsImV4cG9ydCB0eXBlIExpc3RMaW5lQWN0aW9uID0gXCJub25lXCIgfCBcInpvb20taW5cIiB8IFwidG9nZ2xlLWZvbGRpbmdcIjtcbmV4cG9ydCB0eXBlIFN0aWNrQ3Vyc29yID0gXCJuZXZlclwiIHwgXCJidWxsZXQtb25seVwiIHwgXCJidWxsZXQtYW5kLWNoZWNrYm94XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdzIHtcbiAgc3R5bGVMaXN0czogYm9vbGVhbjtcbiAgZGVidWc6IGJvb2xlYW47XG4gIHN0aWNrQ3Vyc29yOiBTdGlja0N1cnNvciB8IGJvb2xlYW47XG4gIGJldHRlckVudGVyOiBib29sZWFuO1xuICBiZXR0ZXJUYWI6IGJvb2xlYW47XG4gIHNlbGVjdEFsbDogYm9vbGVhbjtcbiAgbGlzdExpbmVzOiBib29sZWFuO1xuICBsaXN0TGluZUFjdGlvbjogTGlzdExpbmVBY3Rpb247XG4gIGRuZEV4cGVyaW1lbnQ6IGJvb2xlYW47XG4gIHByZXZpb3VzUmVsZWFzZTogc3RyaW5nIHwgbnVsbDtcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdzID0ge1xuICBzdHlsZUxpc3RzOiB0cnVlLFxuICBkZWJ1ZzogZmFsc2UsXG4gIHN0aWNrQ3Vyc29yOiBcImJ1bGxldC1hbmQtY2hlY2tib3hcIixcbiAgYmV0dGVyRW50ZXI6IHRydWUsXG4gIGJldHRlclRhYjogdHJ1ZSxcbiAgc2VsZWN0QWxsOiB0cnVlLFxuICBsaXN0TGluZXM6IGZhbHNlLFxuICBsaXN0TGluZUFjdGlvbjogXCJ0b2dnbGUtZm9sZGluZ1wiLFxuICBkbmRFeHBlcmltZW50OiBmYWxzZSxcbiAgcHJldmlvdXNSZWxlYXNlOiBudWxsLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBTdG9yYWdlIHtcbiAgbG9hZERhdGEoKTogUHJvbWlzZTxPYnNpZGlhbk91dGxpbmVyUGx1Z2luU2V0dGluZ3M+O1xuICBzYXZlRGF0YShzZXR0aWduczogT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdzKTogUHJvbWlzZTx2b2lkPjtcbn1cblxudHlwZSBLID0ga2V5b2YgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdzO1xudHlwZSBDYWxsYmFjazxUIGV4dGVuZHMgSz4gPSAoY2I6IE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5nc1tUXSkgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzU2VydmljZSBpbXBsZW1lbnRzIE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5ncyB7XG4gIHByaXZhdGUgc3RvcmFnZTogU3RvcmFnZTtcbiAgcHJpdmF0ZSB2YWx1ZXM6IE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5ncztcbiAgcHJpdmF0ZSBoYW5kbGVyczogTWFwPEssIFNldDxDYWxsYmFjazxLPj4+O1xuXG4gIGNvbnN0cnVjdG9yKHN0b3JhZ2U6IFN0b3JhZ2UpIHtcbiAgICB0aGlzLnN0b3JhZ2UgPSBzdG9yYWdlO1xuICAgIHRoaXMuaGFuZGxlcnMgPSBuZXcgTWFwKCk7XG4gIH1cblxuICBnZXQgc3R5bGVMaXN0cygpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuc3R5bGVMaXN0cztcbiAgfVxuICBzZXQgc3R5bGVMaXN0cyh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwic3R5bGVMaXN0c1wiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgZGVidWcoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmRlYnVnO1xuICB9XG4gIHNldCBkZWJ1Zyh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiZGVidWdcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IHN0aWNrQ3Vyc29yKCkge1xuICAgIC8vIEFkYXB0b3IgZm9yIHVzZXJzIG1pZ3JhdGluZyBmcm9tIG9sZGVyIHZlcnNpb24gb2YgdGhlIHBsdWdpbi5cbiAgICBpZiAodGhpcy52YWx1ZXMuc3RpY2tDdXJzb3IgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBcImJ1bGxldC1hbmQtY2hlY2tib3hcIjtcbiAgICB9IGVsc2UgaWYgKHRoaXMudmFsdWVzLnN0aWNrQ3Vyc29yID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIFwibmV2ZXJcIjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnN0aWNrQ3Vyc29yO1xuICB9XG4gIHNldCBzdGlja0N1cnNvcih2YWx1ZTogU3RpY2tDdXJzb3IpIHtcbiAgICB0aGlzLnNldChcInN0aWNrQ3Vyc29yXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBiZXR0ZXJFbnRlcigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuYmV0dGVyRW50ZXI7XG4gIH1cbiAgc2V0IGJldHRlckVudGVyKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJiZXR0ZXJFbnRlclwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgZG5kRXhwZXJpbWVudCgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuZG5kRXhwZXJpbWVudDtcbiAgfVxuICBzZXQgZG5kRXhwZXJpbWVudCh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiZG5kRXhwZXJpbWVudFwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgYmV0dGVyVGFiKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5iZXR0ZXJUYWI7XG4gIH1cbiAgc2V0IGJldHRlclRhYih2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiYmV0dGVyVGFiXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBzZWxlY3RBbGwoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnNlbGVjdEFsbDtcbiAgfVxuICBzZXQgc2VsZWN0QWxsKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJzZWxlY3RBbGxcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IGxpc3RMaW5lcygpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMubGlzdExpbmVzO1xuICB9XG4gIHNldCBsaXN0TGluZXModmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImxpc3RMaW5lc1wiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgbGlzdExpbmVBY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmxpc3RMaW5lQWN0aW9uO1xuICB9XG4gIHNldCBsaXN0TGluZUFjdGlvbih2YWx1ZTogTGlzdExpbmVBY3Rpb24pIHtcbiAgICB0aGlzLnNldChcImxpc3RMaW5lQWN0aW9uXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBwcmV2aW91c1JlbGVhc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnByZXZpb3VzUmVsZWFzZTtcbiAgfVxuICBzZXQgcHJldmlvdXNSZWxlYXNlKHZhbHVlOiBzdHJpbmcgfCBudWxsKSB7XG4gICAgdGhpcy5zZXQoXCJwcmV2aW91c1JlbGVhc2VcIiwgdmFsdWUpO1xuICB9XG5cbiAgb25DaGFuZ2U8VCBleHRlbmRzIEs+KGtleTogVCwgY2I6IENhbGxiYWNrPFQ+KSB7XG4gICAgaWYgKCF0aGlzLmhhbmRsZXJzLmhhcyhrZXkpKSB7XG4gICAgICB0aGlzLmhhbmRsZXJzLnNldChrZXksIG5ldyBTZXQoKSk7XG4gICAgfVxuXG4gICAgdGhpcy5oYW5kbGVycy5nZXQoa2V5KS5hZGQoY2IpO1xuICB9XG5cbiAgcmVtb3ZlQ2FsbGJhY2s8VCBleHRlbmRzIEs+KGtleTogVCwgY2I6IENhbGxiYWNrPFQ+KTogdm9pZCB7XG4gICAgY29uc3QgaGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzLmdldChrZXkpO1xuXG4gICAgaWYgKGhhbmRsZXJzKSB7XG4gICAgICBoYW5kbGVycy5kZWxldGUoY2IpO1xuICAgIH1cbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKERFRkFVTFRfU0VUVElOR1MpKSB7XG4gICAgICB0aGlzLnNldChrIGFzIGtleW9mIE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5ncywgdik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnZhbHVlcyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICB7fSxcbiAgICAgIERFRkFVTFRfU0VUVElOR1MsXG4gICAgICBhd2FpdCB0aGlzLnN0b3JhZ2UubG9hZERhdGEoKVxuICAgICk7XG4gIH1cblxuICBhc3luYyBzYXZlKCkge1xuICAgIGF3YWl0IHRoaXMuc3RvcmFnZS5zYXZlRGF0YSh0aGlzLnZhbHVlcyk7XG4gIH1cblxuICBzZXQ8VCBleHRlbmRzIEs+KGtleTogVCwgdmFsdWU6IE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5nc1tUXSk6IHZvaWQge1xuICAgIHRoaXMudmFsdWVzW2tleV0gPSB2YWx1ZTtcbiAgICBjb25zdCBjYWxsYmFja3MgPSB0aGlzLmhhbmRsZXJzLmdldChrZXkpO1xuXG4gICAgaWYgKCFjYWxsYmFja3MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNiIG9mIGNhbGxiYWNrcy52YWx1ZXMoKSkge1xuICAgICAgY2IodmFsdWUpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IENoYW5nZWxvZ01vZGFsRmVhdHVyZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0NoYW5nZWxvZ01vZGFsRmVhdHVyZVwiO1xuaW1wb3J0IHsgRGVsZXRlU2hvdWxkSWdub3JlQnVsbGV0c0ZlYXR1cmUgfSBmcm9tIFwiLi9mZWF0dXJlcy9EZWxldGVTaG91bGRJZ25vcmVCdWxsZXRzRmVhdHVyZVwiO1xuaW1wb3J0IHsgRHJhZ0FuZERyb3BGZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRHJhZ0FuZERyb3BGZWF0dXJlXCI7XG5pbXBvcnQgeyBFbnN1cmVDdXJzb3JJbkxpc3RDb250ZW50RmVhdHVyZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0Vuc3VyZUN1cnNvckluTGlzdENvbnRlbnRGZWF0dXJlXCI7XG5pbXBvcnQgeyBFbnRlck91dGRlbnRJZkxpbmVJc0VtcHR5RmVhdHVyZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0VudGVyT3V0ZGVudElmTGluZUlzRW1wdHlGZWF0dXJlXCI7XG5pbXBvcnQgeyBFbnRlclNob3VsZENyZWF0ZU5ld0l0ZW1GZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRW50ZXJTaG91bGRDcmVhdGVOZXdJdGVtT25DaGlsZExldmVsRmVhdHVyZVwiO1xuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0ZlYXR1cmVcIjtcbmltcG9ydCB7IEZvbGRGZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRm9sZEZlYXR1cmVcIjtcbmltcG9ydCB7IExpbmVzRmVhdHVyZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0xpbmVzRmVhdHVyZVwiO1xuaW1wb3J0IHsgTGlzdHNTdHlsZXNGZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvTGlzdHNTdHlsZXNGZWF0dXJlXCI7XG5pbXBvcnQgeyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZUZlYXR1cmUgfSBmcm9tIFwiLi9mZWF0dXJlcy9Nb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZUZlYXR1cmVcIjtcbmltcG9ydCB7IE1vdmVJdGVtc0ZlYXR1cmUgfSBmcm9tIFwiLi9mZWF0dXJlcy9Nb3ZlSXRlbXNGZWF0dXJlXCI7XG5pbXBvcnQgeyBTZWxlY3RBbGxGZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvU2VsZWN0QWxsRmVhdHVyZVwiO1xuaW1wb3J0IHsgU2V0dGluZ3NUYWJGZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvU2V0dGluZ3NUYWJGZWF0dXJlXCI7XG5pbXBvcnQgeyBTaGlmdEVudGVyU2hvdWxkQ3JlYXRlTm90ZUZlYXR1cmUgfSBmcm9tIFwiLi9mZWF0dXJlcy9TaGlmdEVudGVyU2hvdWxkQ3JlYXRlTm90ZUZlYXR1cmVcIjtcbmltcG9ydCB7IEFwcGx5Q2hhbmdlc1NlcnZpY2UgfSBmcm9tIFwiLi9zZXJ2aWNlcy9BcHBseUNoYW5nZXNTZXJ2aWNlXCI7XG5pbXBvcnQgeyBJTUVTZXJ2aWNlIH0gZnJvbSBcIi4vc2VydmljZXMvSU1FU2VydmljZVwiO1xuaW1wb3J0IHsgTG9nZ2VyU2VydmljZSB9IGZyb20gXCIuL3NlcnZpY2VzL0xvZ2dlclNlcnZpY2VcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2VydmljZSB9IGZyb20gXCIuL3NlcnZpY2VzL09ic2lkaWFuU2VydmljZVwiO1xuaW1wb3J0IHsgUGFyc2VyU2VydmljZSB9IGZyb20gXCIuL3NlcnZpY2VzL1BhcnNlclNlcnZpY2VcIjtcbmltcG9ydCB7IFBlcmZvcm1PcGVyYXRpb25TZXJ2aWNlIH0gZnJvbSBcIi4vc2VydmljZXMvUGVyZm9ybU9wZXJhdGlvblNlcnZpY2VcIjtcbmltcG9ydCB7IFNldHRpbmdzU2VydmljZSB9IGZyb20gXCIuL3NlcnZpY2VzL1NldHRpbmdzU2VydmljZVwiO1xuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGNvbnN0IFBMVUdJTl9WRVJTSU9OOiBzdHJpbmc7XG4gIGNvbnN0IENIQU5HRUxPR19NRDogc3RyaW5nO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYnNpZGlhbk91dGxpbmVyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBmZWF0dXJlczogRmVhdHVyZVtdO1xuICBwcm90ZWN0ZWQgc2V0dGluZ3M6IFNldHRpbmdzU2VydmljZTtcbiAgcHJpdmF0ZSBsb2dnZXI6IExvZ2dlclNlcnZpY2U7XG4gIHByaXZhdGUgb2JzaWRpYW46IE9ic2lkaWFuU2VydmljZTtcbiAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlclNlcnZpY2U7XG4gIHByaXZhdGUgYXBwbHlDaGFuZ2VzOiBBcHBseUNoYW5nZXNTZXJ2aWNlO1xuICBwcml2YXRlIHBlcmZvcm1PcGVyYXRpb246IFBlcmZvcm1PcGVyYXRpb25TZXJ2aWNlO1xuICBwcml2YXRlIGltZTogSU1FU2VydmljZTtcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgY29uc29sZS5sb2coYExvYWRpbmcgb2JzaWRpYW4tb3V0bGluZXJgKTtcblxuICAgIHRoaXMub2JzaWRpYW4gPSBuZXcgT2JzaWRpYW5TZXJ2aWNlKHRoaXMuYXBwKTtcblxuICAgIHRoaXMuc2V0dGluZ3MgPSBuZXcgU2V0dGluZ3NTZXJ2aWNlKHRoaXMpO1xuICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MubG9hZCgpO1xuXG4gICAgdGhpcy5sb2dnZXIgPSBuZXcgTG9nZ2VyU2VydmljZSh0aGlzLnNldHRpbmdzKTtcblxuICAgIHRoaXMucGFyc2VyID0gbmV3IFBhcnNlclNlcnZpY2UodGhpcy5sb2dnZXIsIHRoaXMuc2V0dGluZ3MpO1xuICAgIHRoaXMuYXBwbHlDaGFuZ2VzID0gbmV3IEFwcGx5Q2hhbmdlc1NlcnZpY2UoKTtcbiAgICB0aGlzLnBlcmZvcm1PcGVyYXRpb24gPSBuZXcgUGVyZm9ybU9wZXJhdGlvblNlcnZpY2UoXG4gICAgICB0aGlzLnBhcnNlcixcbiAgICAgIHRoaXMuYXBwbHlDaGFuZ2VzXG4gICAgKTtcblxuICAgIHRoaXMuaW1lID0gbmV3IElNRVNlcnZpY2UoKTtcbiAgICBhd2FpdCB0aGlzLmltZS5sb2FkKCk7XG5cbiAgICB0aGlzLmZlYXR1cmVzID0gW1xuICAgICAgbmV3IENoYW5nZWxvZ01vZGFsRmVhdHVyZSh0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBEcmFnQW5kRHJvcEZlYXR1cmUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMub2JzaWRpYW4sXG4gICAgICAgIHRoaXMucGFyc2VyLFxuICAgICAgICB0aGlzLnBlcmZvcm1PcGVyYXRpb25cbiAgICAgICksXG4gICAgICBuZXcgU2V0dGluZ3NUYWJGZWF0dXJlKHRoaXMsIHRoaXMuc2V0dGluZ3MpLFxuICAgICAgbmV3IExpc3RzU3R5bGVzRmVhdHVyZSh0aGlzLnNldHRpbmdzLCB0aGlzLm9ic2lkaWFuKSxcbiAgICAgIG5ldyBFbnRlck91dGRlbnRJZkxpbmVJc0VtcHR5RmVhdHVyZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWUsXG4gICAgICAgIHRoaXMub2JzaWRpYW4sXG4gICAgICAgIHRoaXMucGVyZm9ybU9wZXJhdGlvblxuICAgICAgKSxcbiAgICAgIG5ldyBFbnRlclNob3VsZENyZWF0ZU5ld0l0ZW1GZWF0dXJlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLmltZSxcbiAgICAgICAgdGhpcy5vYnNpZGlhbixcbiAgICAgICAgdGhpcy5wZXJmb3JtT3BlcmF0aW9uXG4gICAgICApLFxuICAgICAgbmV3IEVuc3VyZUN1cnNvckluTGlzdENvbnRlbnRGZWF0dXJlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuLFxuICAgICAgICB0aGlzLnBlcmZvcm1PcGVyYXRpb25cbiAgICAgICksXG4gICAgICBuZXcgTW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZExpbmVGZWF0dXJlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLmltZSxcbiAgICAgICAgdGhpcy5vYnNpZGlhbixcbiAgICAgICAgdGhpcy5wZXJmb3JtT3BlcmF0aW9uXG4gICAgICApLFxuICAgICAgbmV3IERlbGV0ZVNob3VsZElnbm9yZUJ1bGxldHNGZWF0dXJlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLmltZSxcbiAgICAgICAgdGhpcy5vYnNpZGlhbixcbiAgICAgICAgdGhpcy5wZXJmb3JtT3BlcmF0aW9uXG4gICAgICApLFxuICAgICAgbmV3IEZvbGRGZWF0dXJlKHRoaXMsIHRoaXMub2JzaWRpYW4pLFxuICAgICAgbmV3IFNlbGVjdEFsbEZlYXR1cmUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lLFxuICAgICAgICB0aGlzLm9ic2lkaWFuLFxuICAgICAgICB0aGlzLnBlcmZvcm1PcGVyYXRpb25cbiAgICAgICksXG4gICAgICBuZXcgTW92ZUl0ZW1zRmVhdHVyZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5pbWUsXG4gICAgICAgIHRoaXMub2JzaWRpYW4sXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMucGVyZm9ybU9wZXJhdGlvblxuICAgICAgKSxcbiAgICAgIG5ldyBTaGlmdEVudGVyU2hvdWxkQ3JlYXRlTm90ZUZlYXR1cmUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMub2JzaWRpYW4sXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lLFxuICAgICAgICB0aGlzLnBlcmZvcm1PcGVyYXRpb25cbiAgICAgICksXG4gICAgICBuZXcgTGluZXNGZWF0dXJlKHRoaXMsIHRoaXMuc2V0dGluZ3MsIHRoaXMub2JzaWRpYW4sIHRoaXMucGFyc2VyKSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBmZWF0dXJlIG9mIHRoaXMuZmVhdHVyZXMpIHtcbiAgICAgIGF3YWl0IGZlYXR1cmUubG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCkge1xuICAgIGNvbnNvbGUubG9nKGBVbmxvYWRpbmcgb2JzaWRpYW4tb3V0bGluZXJgKTtcblxuICAgIGF3YWl0IHRoaXMuaW1lLnVubG9hZCgpO1xuXG4gICAgZm9yIChjb25zdCBmZWF0dXJlIG9mIHRoaXMuZmVhdHVyZXMpIHtcbiAgICAgIGF3YWl0IGZlYXR1cmUudW5sb2FkKCk7XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOlsiTW9kYWwiLCJNYXJrZG93blJlbmRlcmVyIiwia2V5bWFwIiwiZm9sZGVkUmFuZ2VzIiwiZm9sZGFibGUiLCJmb2xkRWZmZWN0IiwidW5mb2xkRWZmZWN0IiwicnVuU2NvcGVIYW5kbGVycyIsImVkaXRvckluZm9GaWVsZCIsIk5vdGljZSIsIlN0YXRlRWZmZWN0IiwiRGVjb3JhdGlvbiIsIlN0YXRlRmllbGQiLCJFZGl0b3JWaWV3IiwiUGxhdGZvcm0iLCJFZGl0b3JTdGF0ZSIsIlByZWMiLCJvYnNpZGlhbiIsIlZpZXdQbHVnaW4iLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFvR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3RHLFFBQVEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3RILFFBQVEsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxFQUFFLENB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
