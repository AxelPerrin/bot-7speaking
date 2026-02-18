// ==UserScript==
// @name         7Speaking AutoBot v1 - Debug Clics
// @namespace    https://github.com/AxelPerrin/bot-7speaking
// @version      1.0
// @description  Bot 7Speaking - Debug complet des clics sur cartes
// @author       axelito
// @match        https://user.7speaking.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════════════════
    const CONFIG = {
        successRate: 0.80,
        successRateAfterVideo: 0.92,
        textWaitMin: 240,
        textWaitMax: 300,
        debug: true,
        visualDebug: true  // Affiche les cartes détectées en rouge
    };

    let afterVideo = false;
    let questionsAnswered = 0;
    let correctAnswers = 0;
    let completedModules = new Set(); // Modules terminés cette session

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILS
    // ═══════════════════════════════════════════════════════════════════════════
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const log = (...a) => CONFIG.debug && console.log('[7S]', ...a);
    const warn = (...a) => console.warn('[7S]', ...a);

    function isPath(regex) {
        return regex.test(location.pathname);
    }

    async function waitFor(selector, timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await wait(300);
        }
        return null;
    }

    function getReact(el) {
        if (!el) return null;
        for (const key in el) {
            if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
                return el[key];
            }
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DRAG & DROP (via Mouse Events - compatible React-DnD)
    // ═══════════════════════════════════════════════════════════════════════════
    async function simulateDragDrop(sourceEl, targetEl) {
        log('Drag & Drop:', sourceEl.textContent?.substring(0, 20), '->', targetEl.textContent?.substring(0, 20));

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const sourceX = sourceRect.left + sourceRect.width / 2;
        const sourceY = sourceRect.top + sourceRect.height / 2;
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        // MÉTHODE 1: Simulation complète via Mouse Events (React-DnD compatible)
        const mouseOpts = { bubbles: true, cancelable: true, button: 0 };

        // MouseDown sur source
        sourceEl.dispatchEvent(new MouseEvent('mousedown', {
            ...mouseOpts, clientX: sourceX, clientY: sourceY
        }));
        await wait(100);

        // MouseMove vers target (plusieurs étapes pour simuler le drag)
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
            const x = sourceX + (targetX - sourceX) * (i / steps);
            const y = sourceY + (targetY - sourceY) * (i / steps);
            document.dispatchEvent(new MouseEvent('mousemove', {
                ...mouseOpts, clientX: x, clientY: y
            }));
            await wait(20);
        }

        // MouseUp sur target
        targetEl.dispatchEvent(new MouseEvent('mouseup', {
            ...mouseOpts, clientX: targetX, clientY: targetY
        }));
        await wait(100);

        // MÉTHODE 2: HTML5 Drag Events (fallback)
        try {
            const dataTransfer = new DataTransfer();

            sourceEl.dispatchEvent(new DragEvent('dragstart', {
                bubbles: true, cancelable: true, clientX: sourceX, clientY: sourceY, dataTransfer
            }));
            await wait(50);

            targetEl.dispatchEvent(new DragEvent('dragenter', {
                bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer
            }));
            targetEl.dispatchEvent(new DragEvent('dragover', {
                bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer
            }));
            await wait(50);

            targetEl.dispatchEvent(new DragEvent('drop', {
                bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer
            }));
            sourceEl.dispatchEvent(new DragEvent('dragend', {
                bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, dataTransfer
            }));
        } catch (e) {
            log('Drag HTML5 fallback error:', e);
        }

        await wait(200);
        return true;
    }

    // Drag via Touch Events (mobile/touch simulation)
    async function simulateTouchDrag(sourceEl, targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const touch = {
            identifier: Date.now(),
            target: sourceEl,
            clientX: sourceRect.left + sourceRect.width / 2,
            clientY: sourceRect.top + sourceRect.height / 2
        };

        const touchStart = new TouchEvent('touchstart', {
            bubbles: true, cancelable: true,
            touches: [touch], targetTouches: [touch], changedTouches: [touch]
        });
        sourceEl.dispatchEvent(touchStart);
        await wait(100);

        touch.clientX = targetRect.left + targetRect.width / 2;
        touch.clientY = targetRect.top + targetRect.height / 2;
        touch.target = targetEl;

        const touchEnd = new TouchEvent('touchend', {
            bubbles: true, cancelable: true,
            touches: [], targetTouches: [], changedTouches: [touch]
        });
        targetEl.dispatchEvent(touchEnd);
        await wait(100);

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CLIC AVANCÉ - Plusieurs méthodes pour cliquer
    // ═══════════════════════════════════════════════════════════════════════════
    async function advancedClick(element, description) {
        const initialUrl = location.href;
        log(`📍 Clic: ${description}`);

        // Debug visuel
        if (CONFIG.visualDebug) {
            element.style.outline = '3px solid red';
            element.style.outlineOffset = '-3px';
        }

        // MÉTHODE 1: Chercher un lien <a> à l'intérieur
        const innerLink = element.querySelector('a[href]');
        if (innerLink) {
            const href = innerLink.getAttribute('href');
            log(`  → Lien trouvé: ${href}`);

            // Si c'est une URL relative valide, naviguer directement
            if (href && href.startsWith('/') && !href.includes('logout')) {
                log(`  → Navigation directe: ${href}`);
                location.href = href;
                await wait(2000);
                return true;
            }

            // Sinon cliquer sur le lien
            innerLink.click();
            await wait(1500);
            if (location.href !== initialUrl) {
                log(`  ✓ Navigation via lien interne`);
                return true;
            }
        }

        // MÉTHODE 2: L'élément lui-même est un lien
        if (element.tagName === 'A' && element.href) {
            log(`  → Élément est un lien: ${element.href}`);
            if (!element.href.includes('logout')) {
                location.href = element.href;
                await wait(2000);
                return true;
            }
        }

        // MÉTHODE 3: Chercher href dans data attributes ou parent
        const href = element.getAttribute('href') ||
                     element.dataset.href ||
                     element.closest('a')?.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('logout')) {
            log(`  → href trouvé: ${href}`);
            location.href = href;
            await wait(2000);
            return true;
        }

        // MÉTHODE 4: Simuler événements souris complets
        log(`  → Simulation événements souris`);
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const eventOpts = {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        };

        element.dispatchEvent(new MouseEvent('mouseenter', eventOpts));
        element.dispatchEvent(new MouseEvent('mouseover', eventOpts));
        await wait(100);
        element.dispatchEvent(new MouseEvent('mousedown', { ...eventOpts, button: 0 }));
        await wait(50);
        element.dispatchEvent(new MouseEvent('mouseup', { ...eventOpts, button: 0 }));
        element.dispatchEvent(new MouseEvent('click', { ...eventOpts, button: 0 }));

        await wait(1500);
        if (location.href !== initialUrl) {
            log(`  ✓ Navigation via événements souris`);
            return true;
        }

        // MÉTHODE 5: Clic direct
        log(`  → Clic direct .click()`);
        element.click();
        await wait(1500);
        if (location.href !== initialUrl) {
            log(`  ✓ Navigation via .click()`);
            return true;
        }

        // MÉTHODE 6: React onClick
        log(`  → Recherche React onClick`);
        const fiber = getReact(element);
        if (fiber) {
            let node = fiber;
            let depth = 0;
            while (node && depth < 20) {
                const props = node.memoizedProps || node.pendingProps || {};
                if (props.onClick) {
                    log(`  → React onClick trouvé`);
                    props.onClick({ preventDefault: () => {}, stopPropagation: () => {} });
                    await wait(1500);
                    if (location.href !== initialUrl) {
                        log(`  ✓ Navigation via React onClick`);
                        return true;
                    }
                }
                node = node.return;
                depth++;
            }
        }

        // MÉTHODE 7: Chercher bouton interne
        const innerButton = element.querySelector('button, [role="button"]');
        if (innerButton) {
            log(`  → Bouton interne trouvé`);
            innerButton.click();
            await wait(1500);
            if (location.href !== initialUrl) {
                log(`  ✓ Navigation via bouton interne`);
                return true;
            }
        }

        log(`  ✗ Aucune méthode n'a fonctionné`);
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEBUG - Analyse complète de la page
    // ═══════════════════════════════════════════════════════════════════════════
    function debugPage() {
        log('═══════════════════════════════════════');
        log('DEBUG PAGE:', location.pathname);
        log('═══════════════════════════════════════');

        // Tous les sélecteurs possibles pour les cartes
        const selectors = [
            '.ksTheme-card',
            '.card--border',
            '.MuiCard-root',
            '[data-testid*="card"]',
            '[data-testid*="item"]',
            '.workshop-card',
            '.lesson-card',
            '.activity-card',
            '.MuiButtonBase-root',
            '.MuiPaper-root',
            'a[href*="/document/"]',
            'a[href*="/workshop/"]',
            'a[href*="/quiz/"]'
        ];

        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) {
                log(`${sel}: ${els.length} éléments`);
                if (els.length <= 5) {
                    els.forEach((el, i) => {
                        const rect = el.getBoundingClientRect();
                        const text = (el.textContent || '').substring(0, 50).trim();
                        log(`  [${i}] ${rect.width}x${rect.height} @ (${Math.round(rect.left)},${Math.round(rect.top)}) "${text}..."`);
                    });
                }
            }
        }

        // Liens cliquables
        const allLinks = document.querySelectorAll('a[href]');
        const relevantLinks = [...allLinks].filter(a => {
            const href = a.getAttribute('href') || '';
            return href.includes('/document/') || href.includes('/workshop/') || href.includes('/quiz/');
        });
        log(`Liens pertinents: ${relevantLinks.length}`);
        relevantLinks.forEach((a, i) => {
            log(`  [${i}] ${a.getAttribute('href')}`);
        });

        log('═══════════════════════════════════════');
    }

    function shouldAnswerCorrectly() {
        questionsAnswered++;
        const rate = afterVideo ? CONFIG.successRateAfterVideo : CONFIG.successRate;
        const correct = Math.random() < rate;
        if (correct) correctAnswers++;
        const currentRate = questionsAnswered > 0 ? Math.round(correctAnswers / questionsAnswered * 100) : 0;
        log(`Q${questionsAnswered}: ${correct ? '✓' : '✗'} (${currentRate}%)`);
        return correct;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUIZ
    // ═══════════════════════════════════════════════════════════════════════════
    async function findQuizAnswer() {
        const container = document.querySelector('.question-container');
        if (!container) return null;

        let node = getReact(container);
        let depth = 0;

        while (node && depth < 100) {
            try {
                const props = node.memoizedProps || node.pendingProps || {};
                if (props.answer) return String(props.answer);
                if (props.answerOptions?.answer?.[0]?.value) return String(props.answerOptions.answer[0].value);
                if (props.children?.props?.answer) return String(props.children.props.answer);
                const c5 = props.children?.[5]?.props?.children?.[0]?.props?.children?.props;
                if (c5?.answer) return String(c5.answer);
                if (c5?.answerOptions?.answer?.[0]?.value) return String(c5.answerOptions.answer[0].value);
            } catch (e) {}
            node = node.return;
            depth++;
        }
        return null;
    }

    async function completeQuiz() {
        log('Quiz: traitement...');
        await wait(1500);

        // DÉTECTION DRAG & DROP
        const dragItems = document.querySelectorAll('[draggable="true"], .draggable, .drag-item, .sortable-item');
        const dropZones = document.querySelectorAll('.drop-zone, .dropzone, .drop-target, .sortable-container, [data-droppable]');

        if (dragItems.length > 0) {
            log(`Quiz: ${dragItems.length} éléments draggables détectés`);

            // Chercher la bonne réponse dans React
            const answer = await findQuizAnswer();

            if (answer && typeof answer === 'object') {
                // Si answer contient l'ordre des éléments
                log('Quiz: ordre de drag =', answer);

                // Essayer de réorganiser selon la réponse
                const items = [...dragItems];
                for (let i = 0; i < items.length - 1; i++) {
                    for (let j = i + 1; j < items.length; j++) {
                        await simulateDragDrop(items[j], items[i]);
                        await wait(500);
                    }
                }
            } else {
                // Drag générique - déplacer vers les zones
                for (const item of dragItems) {
                    for (const zone of dropZones) {
                        if (!zone.contains(item)) {
                            await simulateDragDrop(item, zone);
                            break;
                        }
                    }
                }
            }

            // Chercher bouton suivant/valider après drag
            await wait(1000);
            const submitBtn = document.querySelector('button[type="submit"], .next_btn, button.submit, .validate-btn');
            if (submitBtn) {
                submitBtn.click();
                await wait(1500);
            }
            return true;
        }

        const answer = await findQuizAnswer();

        if (!answer) {
            log('Quiz: réponse non trouvée, skip');
            const btn = document.querySelector('.question__form button[type=submit]');
            if (btn) { btn.click(); await wait(1000); btn.click(); }
            return true;
        }

        log('Quiz: réponse =', answer);
        const shouldBeCorrect = shouldAnswerCorrectly();

        const input = document.querySelector('.question__form input, .question__form textarea');
        if (input) {
            const text = shouldBeCorrect ? answer : 'incorrect';
            input.focus();
            input.value = '';
            for (const char of text) {
                document.execCommand('insertText', false, char);
                await wait(rand(50, 120));
            }
            input.blur();
            await wait(rand(1500, 2500));
        }

        const buttons = [...document.querySelectorAll('.answer-container button')];
        if (buttons.length > 0) {
            let correctBtn = null;
            for (const btn of buttons) {
                const label = btn.querySelector('.question__customLabel');
                if (label && label.textContent.trim() === answer.trim()) {
                    correctBtn = btn;
                    break;
                }
            }

            if (shouldBeCorrect && correctBtn) {
                correctBtn.click();
            } else if (!shouldBeCorrect && buttons.length > 1) {
                const wrongBtns = buttons.filter(b => b !== correctBtn);
                wrongBtns[rand(0, wrongBtns.length - 1)].click();
            } else if (correctBtn) {
                correctBtn.click();
            } else {
                buttons[0].click();
            }
            await wait(500);
        }

        const popup = document.querySelector('.MuiDialog-container');
        if (popup) {
            const btn = popup.querySelector('.MuiDialogActions-root button');
            if (btn) btn.click();
        }

        await wait(300);

        const submit = document.querySelector('.question__form button[type=submit]');
        if (submit) {
            submit.click();
            await wait(rand(1200, 1800));
            submit.click();
            await wait(rand(400, 600));
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXAM
    // ═══════════════════════════════════════════════════════════════════════════
    async function findExamAnswer() {
        const container = document.querySelector('.question_content');
        if (!container) return null;

        let node = getReact(container);
        while (node) {
            try {
                const q = node.memoizedProps?.questions?.[0];
                if (q) {
                    if (q.needorder) {
                        const opts = {};
                        for (const k in q.answer) {
                            opts[k] = q.answer[k].sort((a, b) => a - b);
                        }
                        return opts;
                    }
                    return q.answer;
                }
            } catch (e) {}
            node = node.return;
        }
        return null;
    }

    async function completeExam() {
        log('Exam: traitement...');
        await wait(1000);

        const answer = await findExamAnswer();

        if (answer === null || answer === undefined) {
            const btn = document.querySelector('.buttons_container button:last-child');
            if (btn) { btn.click(); await wait(1500); }
            return true;
        }

        log('Exam: réponse =', answer);

        if (typeof answer === 'object') {
            const isBoolean = Object.values(answer).every(arr =>
                Array.isArray(arr) && arr.every(v => typeof v === 'boolean')
            );

            if (isBoolean) {
                const rows = [...document.querySelectorAll('.question_variant tbody tr')];
                rows.forEach((row, i) => {
                    const inputs = row.querySelectorAll('td input');
                    for (const j in answer) {
                        const inp = inputs[+j - 1];
                        if (inp && answer[j][i]) inp.click();
                    }
                });
            } else {
                const cols = [...document.querySelectorAll('.question_variant tbody tr td')];
                for (const i in answer) {
                    const inputs = cols[+i - 1]?.querySelectorAll('input') || [];
                    answer[i].forEach((val, j) => {
                        const react = getReact(inputs[j]);
                        if (react?.memoizedProps?.onChange) {
                            react.memoizedProps.onChange({ target: { value: String(val) } });
                        }
                    });
                }
            }
        } else {
            const labels = [...document.querySelectorAll('.question_variant label')];
            if (isNaN(answer)) {
                for (const c of String(answer).split(',')) {
                    const idx = c.trim().charCodeAt(0) - 65;
                    if (labels[idx]) labels[idx].click();
                }
            } else {
                const idx = parseInt(answer) - 1;
                if (labels[idx]) labels[idx].click();
            }
        }

        await wait(rand(1200, 1800));
        const btn = document.querySelector('.buttons_container button:last-child');
        if (btn) {
            btn.click();
            await wait(1500);
            btn.click();
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIDEO
    // ═══════════════════════════════════════════════════════════════════════════
    async function watchVideo() {
        const video = document.querySelector('video');
        if (!video || !video.duration || video.duration <= 0) return false;

        log(`Vidéo: ${Math.round(video.duration)}s`);
        afterVideo = true;

        const scriptBtn = document.querySelector('.videoControls__rightContent .icon__iconButton');
        if (scriptBtn) scriptBtn.click();

        try {
            video.muted = true;
            video.playbackRate = 1;
            video.play();
        } catch (e) {}

        while (!video.ended && video.currentTime < video.duration - 2) {
            if (video.paused && !video.ended) {
                try { video.play(); } catch (e) {}
            }
            if (Math.floor(video.currentTime) % 30 === 0 && video.currentTime > 1) {
                log(`Vidéo: ${Math.round(video.currentTime / video.duration * 100)}%`);
            }
            await wait(2000);
        }

        log('Vidéo: terminée');
        await wait(2000);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEXTE
    // ═══════════════════════════════════════════════════════════════════════════
    async function readText() {
        const waitTime = rand(CONFIG.textWaitMin, CONFIG.textWaitMax);
        log(`Texte: ${Math.round(waitTime/60)}min...`);
        afterVideo = false;
        await wait(waitTime * 1000);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LMS EXERCICES (Beginners, Phonetics etc. avec radio buttons)
    // ═══════════════════════════════════════════════════════════════════════════
    async function handleLMSExercise() {
        log('LMS: analyse exercice...');

        // Trouver tous les groupes de questions (1.A, 1.B, 2.A, etc.)
        const radioGroups = document.querySelectorAll('input[type="radio"]');
        if (radioGroups.length === 0) {
            log('LMS: pas de radio buttons');
            return false;
        }

        log(`LMS: ${radioGroups.length} radio buttons trouvés`);

        // Grouper les radios par nom (chaque question a un name unique)
        const groups = {};
        radioGroups.forEach(radio => {
            const name = radio.name || radio.id || Math.random();
            if (!groups[name]) groups[name] = [];
            groups[name].push(radio);
        });

        const groupNames = Object.keys(groups);
        log(`LMS: ${groupNames.length} groupes de questions`);

        // Pour chaque groupe, sélectionner une réponse
        for (const name of groupNames) {
            const radios = groups[name];
            const unchecked = radios.filter(r => !r.checked);

            if (unchecked.length === radios.length) {
                // Aucun n'est coché, on en sélectionne un (avec 80% de chance la bonne)
                const shouldBeCorrect = shouldAnswerCorrectly();

                // Essayer de trouver la bonne réponse via React
                let correctIndex = 0;
                try {
                    const container = radios[0].closest('div, fieldset, form');
                    if (container) {
                        const fiber = getReact(container);
                        let node = fiber;
                        while (node) {
                            const props = node.memoizedProps || {};
                            if (props.answer !== undefined) {
                                correctIndex = parseInt(props.answer) || 0;
                                break;
                            }
                            if (props.correctAnswer !== undefined) {
                                correctIndex = parseInt(props.correctAnswer) || 0;
                                break;
                            }
                            node = node.return;
                        }
                    }
                } catch (e) {}

                // Sélectionner la réponse
                let targetIndex;
                if (shouldBeCorrect) {
                    targetIndex = correctIndex < radios.length ? correctIndex : 0;
                } else {
                    // Mauvaise réponse
                    const wrongOptions = radios.filter((_, i) => i !== correctIndex);
                    if (wrongOptions.length > 0) {
                        targetIndex = radios.indexOf(wrongOptions[rand(0, wrongOptions.length - 1)]);
                    } else {
                        targetIndex = rand(0, radios.length - 1);
                    }
                }

                const target = radios[targetIndex] || radios[0];
                log(`LMS: sélection radio ${name} index ${targetIndex}`);
                target.click();
                await wait(rand(300, 600));
            }
        }

        // Attendre un peu puis chercher le bouton continuer
        await wait(1000);

        const continueBtn = document.querySelector('.next_btn, button.next_btn, [class*="next"], [class*="continue"]');
        if (continueBtn) {
            log('LMS: clic continuer');
            continueBtn.click();
            await wait(2000);
            return true;
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DOCUMENT
    // ═══════════════════════════════════════════════════════════════════════════
    async function handleDocument() {
        log('Document: analyse...');
        await wait(2000);

        if (document.querySelector('.question-container')) {
            return await completeQuiz();
        }

        // PRIORITÉ: Bouton "Passez le quiz" / "Passer le quiz"
        const quizButtons = [...document.querySelectorAll('button, a, [role="button"]')];
        for (const btn of quizButtons) {
            const text = (btn.textContent || '').toLowerCase();
            if (text.includes('passez le quiz') || text.includes('passer le quiz') ||
                text.includes('pass the quiz') || text.includes('take the quiz') ||
                text.includes('commencer le quiz') || text.includes('start quiz')) {
                log('Document: bouton quiz trouvé');
                btn.click();
                await wait(2000);
                return true;
            }
        }

        const video = document.querySelector('video');
        if (video && video.duration > 0) {
            await watchVideo();
        } else {
            await readText();
        }

        // Rechercher à nouveau le bouton quiz après vidéo/texte
        for (const btn of [...document.querySelectorAll('button, a, [role="button"]')]) {
            const text = (btn.textContent || '').toLowerCase();
            if (text.includes('passez le quiz') || text.includes('passer le quiz') ||
                text.includes('pass the quiz') || text.includes('take the quiz') ||
                text.includes('commencer le quiz') || text.includes('start quiz')) {
                log('Document: bouton quiz trouvé (après contenu)');
                btn.click();
                await wait(2000);
                return true;
            }
        }

        const testTab = document.querySelector('.appBarTabs__testTab');
        if (testTab) {
            log('Document: onglet test');
            testTab.click();
            await wait(3000);
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VÉRIFICATION MODULE COMPLÉTÉ
    // ═══════════════════════════════════════════════════════════════════════════
    function isModuleCompleted(cardElement) {
        // Vérifier si le module est déjà terminé (100%, checkmark, "terminé", "completed")
        const text = (cardElement.textContent || '').toLowerCase();

        // VÉRIFICATION 0: Module déjà complété dans cette session
        const link = cardElement.querySelector('a[href*="/document/"], a[href*="/workshop/"]') || cardElement.closest('a[href*="/document/"], a[href*="/workshop/"]');
        if (link) {
            const href = link.getAttribute('href');
            const moduleUrl = href.split('/').slice(0, 4).join('/');
            if (completedModules.has(moduleUrl)) {
                log('isModuleCompleted: dans Set session:', moduleUrl);
                return true;
            }
        }

        // Chercher indicateurs de complétion
        if (text.includes('100%')) return true;
        if (text.includes('terminé') || text.includes('completed') || text.includes('done')) return true;
        if (text.includes('réussi') || text.includes('passed')) return true;

        // Chercher icône checkmark
        const checkIcon = cardElement.querySelector('[data-testid*="check"], .check-icon, .completed-icon, svg[class*="check"]');
        if (checkIcon) return true;

        // Chercher barre de progression à 100%
        const progressBar = cardElement.querySelector('[role="progressbar"], .progress-bar, .MuiLinearProgress-root');
        if (progressBar) {
            const value = progressBar.getAttribute('aria-valuenow') || progressBar.style.width;
            if (value === '100' || value === '100%') return true;
        }

        // Chercher classe "completed" ou "done"
        if (cardElement.classList.contains('completed') || cardElement.classList.contains('done')) return true;
        const completedClass = cardElement.querySelector('.completed, .done, .finished');
        if (completedClass) return true;

        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HOME - Programme Personnel
    // ═══════════════════════════════════════════════════════════════════════════
    async function handleHome() {
        log('Home: recherche...');
        afterVideo = false;
        questionsAnswered = 0;
        correctAnswers = 0;

        await wait(2000);
        debugPage();

        // PRIORITÉ 1: Cartes Programme Personnel (NON COMPLÉTÉES)
        const programCards = [...document.querySelectorAll('[data-testid^="personal-program-item"]')];
        log(`Home: ${programCards.length} cartes Programme Personnel`);

        for (const card of programCards) {
            // Vérifier si le module est déjà complété
            if (isModuleCompleted(card)) {
                log('Home: module déjà complété, skip');
                continue;
            }

            const success = await advancedClick(card, 'Programme Personnel');
            if (success) return true;
        }

        // PRIORITÉ 2: Liens directs document/workshop
        const docLinks = [...document.querySelectorAll('a[href*="/document/"], a[href*="/workshop/"]')];
        for (const link of docLinks) {
            const href = link.getAttribute('href');
            if (href && !href.includes('logout')) {
                // Vérifier si le parent est complété
                const parentCard = link.closest('[data-testid], .card, .MuiCard-root');
                if (parentCard && isModuleCompleted(parentCard)) {
                    log('Home: lien complété, skip');
                    continue;
                }

                log('Home: lien trouvé:', href);
                location.href = href;
                await wait(2000);
                return true;
            }
        }

        // PRIORITÉ 3: Cartes scrollableList (NON COMPLÉTÉES)
        const scrollCards = [...document.querySelectorAll('.scrollableList__content .MuiButtonBase-root')];
        for (const card of scrollCards) {
            const rect = card.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 30) {
                if (isModuleCompleted(card)) {
                    log('Home: carte complétée, skip');
                    continue;
                }

                const success = await advancedClick(card, 'scrollableList');
                if (success) return true;
            }
        }

        log('Home: rien trouvé (tous modules complétés?)');
        await wait(5000);
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WORKSHOP - LOGIQUE AMÉLIORÉE (skip modules complétés)
    // ═══════════════════════════════════════════════════════════════════════════
    async function handleWorkshop() {
        log('Workshop: analyse...');
        await wait(2000);
        debugPage();

        // STRATÉGIE 1: Liens directs vers /document/ (NON COMPLÉTÉS)
        const docLinks = [...document.querySelectorAll('a[href*="/document/"]')];
        log(`Workshop: ${docLinks.length} liens /document/`);

        for (const link of docLinks) {
            const href = link.getAttribute('href');
            const rect = link.getBoundingClientRect();

            // Vérifier visibilité
            if (rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight) {
                // Vérifier si complété
                const parentCard = link.closest('[data-testid], .card, .MuiCard-root, .card--border');
                if (parentCard && isModuleCompleted(parentCard)) {
                    log(`Workshop: ${href} déjà complété, skip`);
                    continue;
                }

                log(`Workshop: navigation vers ${href}`);
                location.href = href;
                await wait(2000);
                return true;
            }
        }

        // STRATÉGIE 2: Cartes avec classes connues (NON COMPLÉTÉES)
        const cardSelectors = [
            '.ksTheme-card',
            '.card--border',
            '.MuiCard-root',
            '.workshop-item',
            '.lesson-item',
            '.activity-item'
        ];

        for (const sel of cardSelectors) {
            const cards = [...document.querySelectorAll(sel)];
            log(`Workshop: ${cards.length} cartes ${sel}`);

            for (const card of cards) {
                const rect = card.getBoundingClientRect();

                // Vérification minimale de taille/visibilité
                if (rect.width < 50 || rect.height < 40) continue;
                if (rect.top < 0 || rect.top > window.innerHeight) continue;

                // Skip si complété
                if (isModuleCompleted(card)) {
                    log(`Workshop: carte ${sel} complétée, skip`);
                    continue;
                }

                const success = await advancedClick(card, `carte ${sel}`);
                if (success) return true;
            }
        }

        // STRATÉGIE 3: Tous les MuiButtonBase visibles (NON COMPLÉTÉS)
        const buttons = [...document.querySelectorAll('.MuiButtonBase-root')];
        log(`Workshop: ${buttons.length} MuiButtonBase`);

        for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();

            // Ignorer les petits boutons (icônes, navigation)
            if (rect.width < 100 || rect.height < 50) continue;
            if (rect.top < 100 || rect.top > window.innerHeight - 50) continue;

            // Ignorer si c'est dans le header ou footer
            const parent = btn.closest('header, footer, nav, .appBar, .bottomNav');
            if (parent) continue;

            // Skip si complété
            if (isModuleCompleted(btn)) {
                continue;
            }

            const text = (btn.textContent || '').substring(0, 30);
            const success = await advancedClick(btn, `MuiButtonBase "${text}"`);
            if (success) return true;
        }

        // STRATÉGIE 4: Bouton quiz legacy
        const quizBtn = document.querySelector('.category-action-bottom button, button.cardMode__goToQuiz');
        if (quizBtn) {
            quizBtn.click();
            await wait(2000);
            return true;
        }

        // STRATÉGIE 5: Liens /quiz/
        const quizLinks = [...document.querySelectorAll('a[href*="/quiz/"]')];
        for (const link of quizLinks) {
            const href = link.getAttribute('href');
            if (href) {
                log(`Workshop: lien quiz ${href}`);
                location.href = href;
                await wait(2000);
                return true;
            }
        }

        log('Workshop: tous modules complétés, retour home');
        location.href = '/home';
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ROUTEUR
    // ═══════════════════════════════════════════════════════════════════════════
    async function route() {
        const path = location.pathname;
        log('Route:', path);

        try {
            // PRIORITÉ 0: Bouton "Passer le quiz" - PRIORITÉ MAXIMALE
            const quizPassButtons = [...document.querySelectorAll('button, a, [role="button"]')];
            for (const btn of quizPassButtons) {
                const text = (btn.textContent || '').toLowerCase().trim();
                if ((text.includes('passez le quiz') || text.includes('passer le quiz') ||
                    text.includes('pass the quiz') || text.includes('take the quiz') ||
                    text.includes('commencer le quiz') || text.includes('start quiz')) &&
                    !text.includes('recommencer')) {
                    log('💥 Bouton PASSER LE QUIZ trouvé! PRIORITÉ MAX');
                    btn.click();
                    await wait(2000);
                    return true;
                }
            }

            // PRIORITÉ 0.5: Détection page de RÉSULTATS (score affiché + félicitations)
            const resultContainer = document.querySelector('.result-container, .results-container, .quiz-results');
            const statsCounter = document.querySelector('.stats_counter, .stats__counter, [class*="stats_counter"]');
            const pageText = document.body.textContent.toLowerCase();
            const hasCompletionText = pageText.includes('félicitations') ||
                                      pageText.includes('vous avez terminé') ||
                                      pageText.includes('votre score') ||
                                      pageText.includes('congratulations') ||
                                      pageText.includes('completed your test');

            // Page de résultats si: container résultat OU (score affiché + texte de complétion)
            if (resultContainer || (statsCounter && hasCompletionText)) {
                log('📊 Page de RÉSULTATS détectée!');

                // Marquer ce module comme complété
                const moduleUrl = location.pathname.split('/').slice(0, 4).join('/');
                completedModules.add(moduleUrl);
                log('Module complété:', moduleUrl, '| Total:', completedModules.size);
                afterVideo = false;

                // Chercher bouton "Continuer" (PAS "Revoir le document")
                const allResultBtns = [...document.querySelectorAll('.btns__container button, .btns__container a, .buttons-container button, .result-buttons button, button, a')];
                for (const btn of allResultBtns) {
                    const text = (btn.textContent || '').toLowerCase().trim();
                    if (text.includes('continuer') || text.includes('continue') || text.includes('suivant') || text.includes('next')) {
                        log('📊 Clic sur Continuer dans résultats');
                        btn.click();
                        await wait(1500);
                        break;
                    }
                }

                // TOUJOURS retourner à home après les résultats
                log('📊 Retour home après quiz...');
                location.href = '/home';
                await wait(3000);
                return true;
            }

            // PRIORITÉ 1: "Retour à la liste des leçons" - FIN de quiz LMS
            const returnButtons = [...document.querySelectorAll('button, a, [role="button"]')];
            for (const btn of returnButtons) {
                const text = (btn.textContent || '').toLowerCase().trim();
                if (text.includes('retour à la liste') || text.includes('retour aux leçons') ||
                    text.includes('back to lessons') || text.includes('return to lessons') ||
                    text.includes('liste des leçons')) {
                    log('🏠 Bouton RETOUR LEÇONS trouvé! Quiz terminé');
                    btn.click();
                    await wait(2000);
                    return true;
                }
            }

            // EXERCICES LMS (radio buttons) - DOIT être traité AVANT le bouton Continuer
            const radioGroups = document.querySelectorAll('input[type="radio"]');
            if (radioGroups.length > 0) {
                // Vérifier si des radios ne sont pas cochés
                const groups = {};
                radioGroups.forEach(radio => {
                    const name = radio.name || 'default';
                    if (!groups[name]) groups[name] = [];
                    groups[name].push(radio);
                });

                let hasUnchecked = false;
                for (const name in groups) {
                    const radios = groups[name];
                    const checked = radios.some(r => r.checked);
                    if (!checked) {
                        hasUnchecked = true;
                        break;
                    }
                }

                if (hasUnchecked) {
                    log('LMS: exercices non complétés, remplissage...');
                    const handled = await handleLMSExercise();
                    if (handled) return true;
                }
            }

            // PRIORITÉ ABSOLUE: Boutons "Suivant" / "Continuer" / "Passer le quiz" - skip tout le reste
            // MAIS PAS "Recommencer" !
            const allButtons = [...document.querySelectorAll('button, a, [role="button"], .MuiButton-root, .next_btn')];
            for (const btn of allButtons) {
                const text = (btn.textContent || '').toLowerCase().trim();

                // IGNORER les boutons "Recommencer"
                if (text.includes('recommencer') || text.includes('restart') || text.includes('retry')) {
                    continue;
                }

                // Bouton Suivant / Continuer (priorité maximale)
                if (text.includes('suivant') || text.includes('next') ||
                    text.includes('continuer') || text.includes('continue') ||
                    btn.classList.contains('next_btn') || btn.classList.contains('next-btn')) {
                    log('🎯 Bouton SUIVANT/CONTINUER trouvé! Skip tout le reste');
                    btn.click();
                    await wait(2000);
                    return true;
                }

                // Bouton Quiz (mais pas "Recommencer le quiz")
                if ((text.includes('passez le quiz') || text.includes('passer le quiz') ||
                    text.includes('pass the quiz') || text.includes('take the quiz') ||
                    text.includes('commencer le quiz') || text.includes('start quiz') ||
                    text === 'quiz' || text.includes('go to quiz')) &&
                    !text.includes('recommencer')) {
                    log('🎯 Bouton QUIZ trouvé! Skip tout le reste');
                    btn.click();
                    await wait(2000);
                    return true;
                }
            }

            // EXERCICES LMS - backup si pas détecté avant
            const lmsContent = document.querySelector('.LMS__content, .beginners_topic__content, main.LMS__content');
            if (lmsContent) {
                const handled = await handleLMSExercise();
                if (handled) return true;
            }

            // Quiz terminé
            if (document.querySelector('.result-container')) {
                log('Quiz terminé');
                afterVideo = false;
                location.href = '/home';
                await wait(3000);
                return true;
            }

            // Quiz visible
            if (document.querySelector('.question-container')) {
                return await completeQuiz();
            }

            // Exam
            if (document.querySelector('.question_content')) {
                return await completeExam();
            }

            // HOME
            if (isPath(/^\/home/) || path === '/') {
                return await handleHome();
            }

            // DOCUMENT
            if (isPath(/^\/document\/\d+/)) {
                return await handleDocument();
            }

            // WORKSHOP EXAM
            if (isPath(/^\/workshop\/exams-tests/)) {
                const search = new URLSearchParams(location.search);
                if (search.has('id')) {
                    return await completeExam();
                } else {
                    const nextExam = await waitFor('.lists .list__items.active');
                    if (nextExam) {
                        nextExam.click();
                        await wait(500);
                        const confirmBtn = document.querySelector('.confirmCloseDialog__buttons button:last-child');
                        if (confirmBtn) confirmBtn.click();
                        await wait(2000);
                    }
                    return true;
                }
            }

            // WORKSHOP
            if (isPath(/^\/workshop/)) {
                return await handleWorkshop();
            }

            // QUIZ
            if (isPath(/^\/quiz/)) {
                if (document.querySelector('.question-container')) {
                    return await completeQuiz();
                }
                await wait(2000);
                return true;
            }

            // PAGE INCONNUE
            log('Page inconnue:', path);
            debugPage();
            await wait(2000);

            // Essayer de trouver quelque chose de cliquable
            const anyLinks = [...document.querySelectorAll('a[href*="/document/"], a[href*="/workshop/"], a[href*="/quiz/"]')];
            for (const link of anyLinks) {
                const href = link.getAttribute('href');
                if (href && !href.includes('logout')) {
                    log('Lien trouvé:', href);
                    location.href = href;
                    await wait(2000);
                    return true;
                }
            }

            log('Retour home');
            location.href = '/home';
            await wait(3000);
            return true;

        } catch (e) {
            console.error('[7S] Erreur:', e);
            await wait(3000);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOUCLE
    // ═══════════════════════════════════════════════════════════════════════════
    async function mainLoop() {
        let errors = 0;

        while (true) {
            try {
                const success = await route();
                errors = success ? 0 : errors + 1;

                if (errors > 10) {
                    log('Refresh...');
                    location.reload();
                }
            } catch (e) {
                errors++;
            }

            await wait(2000);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UI
    // ═══════════════════════════════════════════════════════════════════════════
    function createUI() {
        const ui = document.createElement('div');
        ui.id = '7s-bot';
        ui.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #0f0;
            padding: 12px 16px;
            border-radius: 10px;
            font-family: Consolas, monospace;
            font-size: 12px;
            z-index: 999999;
            border: 1px solid #0f0;
            max-width: 250px;
        `;
        ui.innerHTML = `
            <div style="color:#0ff;font-weight:bold;margin-bottom:6px">🤖 7Speaking Bot v16</div>
            <div style="color:#ff0;font-size:10px;margin-bottom:4px">Debug Mode</div>
            <div id="7s-status">Mode: 80%</div>
            <div id="7s-rate">Taux: --%</div>
            <div id="7s-path" style="font-size:10px;color:#888;margin-top:4px"></div>
        `;
        document.body.appendChild(ui);

        setInterval(() => {
            const status = document.getElementById('7s-status');
            const rate = document.getElementById('7s-rate');
            const pathEl = document.getElementById('7s-path');
            if (status) status.textContent = `Mode: ${afterVideo ? '🎬 92%' : '📊 80%'}`;
            if (rate && questionsAnswered > 0) {
                rate.textContent = `Taux: ${Math.round(correctAnswers / questionsAnswered * 100)}%`;
            }
            if (pathEl) pathEl.textContent = location.pathname;
        }, 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════════════════
    function init() {
        log('═══════════════════════════════════════');
        log('  7Speaking Bot v16 - Debug Mode');
        log('  Visual debug:', CONFIG.visualDebug);
        log('═══════════════════════════════════════');

        createUI();
        setTimeout(mainLoop, 2000);
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
