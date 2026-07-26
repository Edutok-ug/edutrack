        // ============================================================
        // CONFIGURATION
        // ============================================================
        const AUTH_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqbZonWJJLWCIIlCyjEL_XuNuMmoT5ONVAJ1R-KxlTgFbNLGEcxcEIAu-xuERV0VId/exec';
        const DATA_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzL6mL6_CAkz2vZAbfEN1BjpZKhPiTTUN7--EhppDgJi5UGCiD306BPnNOu8AenX0Wv/exec';
        const ACCOUNTS_SHEET_ID ='1w9PfN_vtpgzKO8WlJATBWiqKNypR15uFxqSTrTeyPQU';

        // ============================================================
        // VARIABLES
        // ============================================================
        let studentList = [];
        let scoreRows = [];
        let allReportData = [];
        let miniReportData = [];
        let studentPhotos = {};
        let photoIdCounter = 0;
        let isManualId = false;
        let scoreRowsBackup = [];
        let classData = {};
        let authSession = null;
        let pendingAuthRole = 'admin';
        let pendingAuthMode = 'login';
        let tpScoreRows = [];
        let tpScoreRowsBackup = [];

        // ============================================================
        // CLASS MANAGEMENT
        // ============================================================
        const CLASSES = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
        const CLASS_IDS = {
            'S.1': 'classS1',
            'S.2': 'classS2',
            'S.3': 'classS3',
            'S.4': 'classS4',
            'S.5': 'classS5',
            'S.6': 'classS6'
        };

        function getClassLink(cls) {
            const el = document.getElementById(CLASS_IDS[cls]);
            return el ? el.value.trim() : '';
        }

        function getClassSheetId(cls) {
            const link = getClassLink(cls);
            if (!link) return '';
            const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
            return match ? match[1] : '';
        }

        function getDataScriptUrl() { return DATA_SCRIPT_URL; }
        function getAuthScriptUrl() { return AUTH_SCRIPT_URL; }
        function getAccountsSheetId() { return ACCOUNTS_SHEET_ID; }

        // ============================================================
        // TEACHER ASSIGNMENTS - Multiple Classes & Subjects
        // ============================================================
        let assignmentCounter = 0;

        function addAssignmentRow() {
            const container = document.getElementById('teacherAssignmentsContainer');
            const div = document.createElement('div');
            div.className = 'teacher-assignment-item';
            div.dataset.id = assignmentCounter++;
            div.innerHTML = `
                <select class="teacher-assignment-class">
                    <option value="">Select Class</option>
                    <option value="S.1">S.1</option>
                    <option value="S.2">S.2</option>
                    <option value="S.3">S.3</option>
                    <option value="S.4">S.4</option>
                    <option value="S.5">S.5</option>
                    <option value="S.6">S.6</option>
                </select>
                <select class="teacher-assignment-subject">
                    <option value="">Select Subject</option>
                    <option value="English">English</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Geography">Geography</option>
                    <option value="History">History</option>
                    <option value="CRE">CRE</option>
                    <option value="Computer Studies">Computer Studies</option>
                    <option value="Luganda">Luganda</option>
                    <option value="Kiswahili">Kiswahili</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Entrepreneurship">Entrepreneurship</option>
                </select>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeAssignment(this)">✕</button>
            `;
            container.appendChild(div);
        }

        function removeAssignment(btn) {
            const item = btn.closest('.teacher-assignment-item');
            if (document.querySelectorAll('.teacher-assignment-item').length > 1) {
                item.remove();
            } else {
                showStatus('At least one assignment is required.', 'warning');
            }
        }

        function getTeacherAssignments() {
            const items = document.querySelectorAll('.teacher-assignment-item');
            const assignments = [];
            items.forEach(item => {
                const cls = item.querySelector('.teacher-assignment-class').value;
                const subject = item.querySelector('.teacher-assignment-subject').value;
                if (cls && subject) {
                    assignments.push({ class: cls, subject: subject });
                }
            });
            return assignments;
        }

        // ============================================================
        // TAB SWITCHING
        // ============================================================
        function switchTab(tab) {
            if (!authSession || authSession.role !== 'admin') return;

            document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            
            const tabMap = {
                'dashboard': 'tabDashboard',
                'register': 'tabRegister',
                'scores': 'tabScores',
                'mini': 'tabMini',
                'report': 'tabReport',
                'settings': 'tabSettings'
            };
            
            document.getElementById(tabMap[tab]).classList.add('active');
            document.querySelectorAll('.tab').forEach((el) => {
                if (el.getAttribute('data-tab') === tab) {
                    el.classList.add('active');
                }
            });
            
            document.getElementById('statusMessage').style.display = 'none';
            
            if (tab === 'register') {
                loadClassSelectors();
                updateRegisterClassInfo();
                if (!isManualId) fetchNextStudentId();
            }
            if (tab === 'scores') {
                loadClassSelectors();
                updateScoreClassInfo();
                const cls = document.getElementById('scoreClassSelect').value;
                if (cls) loadStudents();
            }
            if (tab === 'mini') {
                loadClassSelectors();
                updateMiniClassInfo();
            }
            if (tab === 'report') {
                loadClassSelectors();
                updateReportClassInfo();
                const cls = document.getElementById('reportClassSelect').value;
                if (cls) {
                    document.getElementById('reportResults').innerHTML = '<div class="loading-spinner active" style="display:block;"><div class="spinner"></div><p style="margin-top:10px;">Loading report data...</p></div>';
                    fetchReportData();
                }
            }
            if (tab === 'settings') {
                renderTeacherAccountsTable();
            }
            if (tab === 'dashboard') updateDashboard();
        }

        // ============================================================
        // CLASS INFO UPDATES
        // ============================================================
        function loadClassSelectors() {
            const selects = ['regClassSelect', 'scoreClassSelect', 'miniClassSelect', 'reportClassSelect'];
            selects.forEach(id => {
                const select = document.getElementById(id);
                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">Select a Class</option>';
                    CLASSES.forEach(cls => {
                        const option = document.createElement('option');
                        option.value = cls;
                        option.textContent = cls;
                        if (getClassLink(cls)) {
                            option.textContent = cls + ' ✅';
                        }
                        select.appendChild(option);
                    });
                    if (currentValue && [...select.options].some(o => o.value === currentValue)) {
                        select.value = currentValue;
                    } else {
                        const defaultClass = document.getElementById('settingsDefaultClass')?.value || 'S.2';
                        if ([...select.options].some(o => o.value === defaultClass)) {
                            select.value = defaultClass;
                        }
                    }
                }
            });
        }

        function updateRegisterClassInfo() {
            const cls = document.getElementById('regClassSelect').value;
            const info = document.getElementById('regClassInfo');
            if (cls) {
                const link = getClassLink(cls);
                const sheetId = getClassSheetId(cls);
                if (link) {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/>Sheet ID: <span style="font-family:monospace;font-size:12px;">${sheetId || 'Not configured'}</span>`;
                } else {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/><span style="color:#e85d04;">⚠️ No link configured in Settings</span>`;
                }
            } else {
                info.textContent = 'Select a class to view details';
            }
            if (cls && !isManualId) fetchNextStudentId();
        }

        function updateScoreClassInfo() {
            const cls = document.getElementById('scoreClassSelect').value;
            const info = document.getElementById('scoreClassInfo');
            if (cls) {
                const link = getClassLink(cls);
                const sheetId = getClassSheetId(cls);
                if (link) {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/>Sheet ID: <span style="font-family:monospace;font-size:12px;">${sheetId || 'Not configured'}</span>`;
                } else {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/><span style="color:#e85d04;">⚠️ No link configured in Settings</span>`;
                }
            } else {
                info.textContent = 'Select a class to view details';
            }
        }

        function updateMiniClassInfo() {
            const cls = document.getElementById('miniClassSelect').value;
            const info = document.getElementById('miniClassInfo');
            if (cls) {
                const link = getClassLink(cls);
                const sheetId = getClassSheetId(cls);
                if (link) {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/>Sheet ID: <span style="font-family:monospace;font-size:12px;">${sheetId || 'Not configured'}</span>`;
                } else {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/><span style="color:#e85d04;">⚠️ No link configured in Settings</span>`;
                }
            } else {
                info.textContent = 'Select a class to view details';
            }
        }

        function updateReportClassInfo() {
            const cls = document.getElementById('reportClassSelect').value;
            const info = document.getElementById('reportClassInfo');
            if (cls) {
                const link = getClassLink(cls);
                const sheetId = getClassSheetId(cls);
                if (link) {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/>Sheet ID: <span style="font-family:monospace;font-size:12px;">${sheetId || 'Not configured'}</span>`;
                } else {
                    info.innerHTML = `Class: <strong>${cls}</strong><br/><span style="color:#e85d04;">⚠️ No link configured in Settings</span>`;
                }
            } else {
                info.textContent = 'Select a class to view details';
            }
        }

        // ============================================================
        // STUDENT REGISTRATION
        // ============================================================
        function toggleManualId() {
            isManualId = document.getElementById('manualIdToggle').checked;
            const idInput = document.getElementById('regStudentId');
            if (isManualId) {
                idInput.disabled = false;
                idInput.placeholder = 'Enter Student ID (e.g., Stu001)';
                idInput.value = '';
            } else {
                idInput.disabled = true;
                idInput.placeholder = 'Auto-generated';
                fetchNextStudentId();
            }
        }

        function fetchNextStudentId() {
            const cls = document.getElementById('regClassSelect').value;
            if (!cls) return;
            const sheetId = getClassSheetId(cls);
            if (!sheetId) {
                document.getElementById('regStudentId').value = 'Stu001';
                document.getElementById('regIdDisplay').textContent = 'Stu001';
                return;
            }
            const scriptUrl = getDataScriptUrl();
            if (!scriptUrl) return;
            const formData = new URLSearchParams();
            formData.append('action', 'getNextStudentId');
            formData.append('sheetId', sheetId);
            fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            })
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data) {
                    const id = result.data.nextId || 'Stu001';
                    document.getElementById('regStudentId').value = id;
                    document.getElementById('regIdDisplay').textContent = id;
                }
            })
            .catch(err => console.error('Error:', err));
        }

        function loadRegisterSettings() {
            const savedClass = localStorage.getItem('regClass');
            if (savedClass) document.getElementById('regClassSelect').value = savedClass;
            const savedTerm = localStorage.getItem('regTerm');
            if (savedTerm) document.getElementById('regTerm').value = savedTerm;
            const savedYear = localStorage.getItem('regYear');
            if (savedYear) document.getElementById('regYear').value = savedYear;
            updateRegisterClassInfo();
            if (!isManualId) fetchNextStudentId();
        }

        function resetRegisterForm() {
            document.getElementById('registerForm').style.display = 'block';
            document.getElementById('regSuccess').style.display = 'none';
            document.getElementById('statusMessage').style.display = 'none';
            document.getElementById('regSubmitBtn').disabled = false;
            document.getElementById('regSubmitBtn').textContent = '📤 Register';
            document.getElementById('regStudentName').value = '';
            document.getElementById('regTerm').value = 'III';
            document.getElementById('regYear').value = '2025';
            isManualId = false;
            document.getElementById('manualIdToggle').checked = false;
            document.getElementById('regStudentId').disabled = true;
            document.getElementById('regStudentId').placeholder = 'Auto-generated';
            fetchNextStudentId();
            showStatus('Form reset. Ready for new student.', 'info');
        }

        async function registerStudent(event) {
            event.preventDefault();

            const cls = document.getElementById('regClassSelect').value;
            const sheetId = getClassSheetId(cls);
            const studentId = document.getElementById('regStudentId').value.trim();
            const studentName = document.getElementById('regStudentName').value.trim();
            const scriptUrl = getDataScriptUrl();

            if (!cls) { showStatus('Please select a class.', 'error'); return; }
            if (!sheetId) { showStatus('Class link not configured in Settings.', 'error'); return; }
            if (!studentId) { showStatus('Please enter or generate a Student ID.', 'error'); return; }
            if (!studentName) { showStatus('Please enter the student\'s full name.', 'error'); return; }

            const formData = new URLSearchParams();
            formData.append('action', 'registerStudent');
            formData.append('sheetId', sheetId);
            formData.append('studentId', studentId);
            formData.append('studentName', studentName);
            formData.append('class', cls);
            formData.append('term', document.getElementById('regTerm').value);
            formData.append('year', document.getElementById('regYear').value);
            formData.append('timestamp', new Date().toISOString());

            const submitBtn = document.getElementById('regSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Saving...';
            showStatus('Registering student...', 'info');
            document.getElementById('loadingSpinner').classList.add('active');

            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                document.getElementById('loadingSpinner').classList.remove('active');
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Register';

                if (result.success) {
                    document.getElementById('registerForm').style.display = 'none';
                    document.getElementById('regSuccess').style.display = 'block';
                    document.getElementById('regSuccessId').textContent = studentId;
                    showStatus('', '');
                    updateDashboard();
                    localStorage.setItem('regClass', cls);
                    localStorage.setItem('regTerm', document.getElementById('regTerm').value);
                    localStorage.setItem('regYear', document.getElementById('regYear').value);
                    setTimeout(() => { if (!isManualId) fetchNextStudentId(); }, 500);
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                document.getElementById('loadingSpinner').classList.remove('active');
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Register';
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        // ============================================================
        // LOAD STUDENTS
        // ============================================================
        async function loadStudents() {
            const cls = document.getElementById('scoreClassSelect').value;
            const sheetId = getClassSheetId(cls);
            const scriptUrl = getDataScriptUrl();
            
            if (!cls) { showStatus('Please select a class.', 'error'); return; }
            if (!sheetId) { showStatus('Class link not configured in Settings.', 'error'); return; }

            localStorage.setItem('scoreClass', cls);
            showStatus('Loading students...', 'info');
            document.getElementById('loadingSpinner').classList.add('active');

            try {
                const formData = new URLSearchParams();
                formData.append('action', 'getStudents');
                formData.append('sheetId', sheetId);

                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                document.getElementById('loadingSpinner').classList.remove('active');

                if (result.success) {
                    studentList = result.data?.students || [];
                    const count = studentList.length;
                    document.getElementById('studentCountDisplay').style.display = 'block';
                    document.getElementById('studentCount').textContent = count;
                    
                    if (count > 0) {
                        showStatus(`✅ Loaded ${count} students from ${cls}`, 'success');
                        scoreRows = studentList.map(s => ({ 
                            studentId: s.studentId, 
                            studentName: s.studentName,
                            aoi: '', 
                            eot: ''
                        }));
                        scoreRowsBackup = [...scoreRows];
                        renderScoreTable();
                        updateScoreSummary();
                        saveScoresSettings();
                        updateDashboard();
                    } else {
                        showStatus('⚠️ No students found in ' + cls, 'warning');
                        scoreRows = [];
                        renderScoreTable();
                        updateScoreSummary();
                    }
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                document.getElementById('loadingSpinner').classList.remove('active');
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        function refreshStudents() { loadStudents(); }

        // ============================================================
        // SCORE POSTING
        // ============================================================
        function filterScoreRows() {
            const searchTerm = document.getElementById('scoreSearchInput').value.toLowerCase().trim();
            if (!searchTerm) {
                scoreRows = [...scoreRowsBackup];
                renderScoreTable();
                document.getElementById('scoreSearchCount').textContent = 'Showing all students';
                return;
            }
            const filtered = scoreRowsBackup.filter(row => 
                row.studentId.toLowerCase().includes(searchTerm) || 
                row.studentName.toLowerCase().includes(searchTerm)
            );
            scoreRows = filtered;
            renderScoreTable();
            document.getElementById('scoreSearchCount').textContent = `Showing ${filtered.length} of ${scoreRowsBackup.length} students`;
        }

        function removeScoreRow(index) {
            const actualIndex = scoreRowsBackup.indexOf(scoreRows[index]);
            if (actualIndex !== -1) scoreRowsBackup.splice(actualIndex, 1);
            scoreRows.splice(index, 1);
            renderScoreTable();
            updateScoreSummary();
            saveScoresSettings();
            document.getElementById('scoreSearchCount').textContent = `Showing ${scoreRows.length} of ${scoreRowsBackup.length} students`;
        }

        function updateScoreRow(index, field, value) {
            scoreRows[index][field] = value;
            const actualIndex = scoreRowsBackup.indexOf(scoreRows[index]);
            if (actualIndex !== -1) scoreRowsBackup[actualIndex][field] = value;
            updateScoreSummary();
            saveScoresSettings();
        }

        function renderScoreTable() {
            const tbody = document.getElementById('scoreTableBody');
            if (scoreRows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999; padding:30px;">📋 No students found in this class.</td></tr>`;
                return;
            }
            tbody.innerHTML = scoreRows.map((row, index) => `
                <tr>
                    <td class="student-id-col">${row.studentId}</td>
                    <td class="student-name-col">${row.studentName}</td>
                    <td><input type="number" class="score-input-aoi" value="${row.aoi}" placeholder="0-20" min="0" max="20" onchange="updateScoreRow(${index}, 'aoi', this.value)" onkeyup="updateScoreRow(${index}, 'aoi', this.value)" /></td>
                    <td><input type="number" class="score-input-eot" value="${row.eot}" placeholder="0-80" min="0" max="80" onchange="updateScoreRow(${index}, 'eot', this.value)" onkeyup="updateScoreRow(${index}, 'eot', this.value)" /></td>
                    <td><button class="remove-row" onclick="removeScoreRow(${index})">✕</button></td>
                </tr>
            `).join('');
        }

        function updateScoreSummary() {
            const valid = scoreRows.filter(r => r.studentId && r.studentId.trim());
            const total = valid.length;
            let totalAoi = 0, totalEot = 0;
            valid.forEach(r => { totalAoi += parseFloat(r.aoi) || 0; totalEot += parseFloat(r.eot) || 0; });
            document.getElementById('totalStudents').textContent = total;
            document.getElementById('avgAoi').textContent = total > 0 ? (totalAoi / total).toFixed(1) : '0.0';
            document.getElementById('avgEot').textContent = total > 0 ? (totalEot / total).toFixed(1) : '0.0';
            document.getElementById('scoreSubjectDisplay').textContent = document.getElementById('scoreSubject').value || '-';
        }

        function loadScoresSettings() {
            const savedClass = localStorage.getItem('scoreClass');
            if (savedClass) document.getElementById('scoreClassSelect').value = savedClass;
            const savedSubject = localStorage.getItem('scoreSubject');
            if (savedSubject) document.getElementById('scoreSubject').value = savedSubject;
            const savedScores = localStorage.getItem('scoreRows');
            if (savedScores) {
                try {
                    const parsed = JSON.parse(savedScores);
                    if (parsed && parsed.length > 0) { 
                        scoreRows = parsed;
                        scoreRowsBackup = [...parsed];
                        renderScoreTable(); 
                        updateScoreSummary(); 
                        return; 
                    }
                } catch (e) {}
            }
            setTimeout(() => {
                if (document.getElementById('scoreClassSelect').value) loadStudents();
            }, 500);
        }

        function saveScoresSettings() {
            localStorage.setItem('scoreClass', document.getElementById('scoreClassSelect').value);
            localStorage.setItem('scoreSubject', document.getElementById('scoreSubject').value);
            localStorage.setItem('scoreRows', JSON.stringify(scoreRowsBackup));
        }

        function resetScoresForm() {
            document.getElementById('scoresForm').style.display = 'block';
            document.getElementById('scoreSuccess').style.display = 'none';
            document.getElementById('statusMessage').style.display = 'none';
            document.getElementById('scoreSubmitBtn').disabled = false;
            document.getElementById('scoreSubmitBtn').textContent = '📤 Post Scores';
            scoreRows = [];
            scoreRowsBackup = [];
            document.getElementById('studentCountDisplay').style.display = 'none';
            renderScoreTable();
            updateScoreSummary();
            saveScoresSettings();
            document.getElementById('scoreSearchInput').value = '';
            document.getElementById('scoreSearchCount').textContent = 'Showing all students';
            document.getElementById('teacherInitials').value = '';
            showStatus('Form reset.', 'info');
        }

        async function postScores(event) {
            event.preventDefault();

            const cls = document.getElementById('scoreClassSelect').value;
            const sheetId = getClassSheetId(cls);
            const subject = document.getElementById('scoreSubject').value;
            const teacherInitials = document.getElementById('teacherInitials').value.trim().toUpperCase();
            const scriptUrl = getDataScriptUrl();

            if (!cls) { showStatus('Please select a class.', 'error'); return; }
            if (!sheetId) { showStatus('Class link not configured in Settings.', 'error'); return; }
            if (!subject) { showStatus('Please select a subject.', 'error'); return; }
            if (!teacherInitials) { showStatus('Please enter teacher initials.', 'error'); return; }

            let hasValidScore = false;
            for (const row of scoreRows) {
                if (row.aoi !== '' || row.eot !== '') {
                    hasValidScore = true;
                    break;
                }
            }
            if (!hasValidScore) {
                showStatus('Please enter at least AOI or EOT for at least one student.', 'error');
                return;
            }

            let hasError = false;
            for (const row of scoreRows) {
                const aoi = parseFloat(row.aoi);
                const eot = parseFloat(row.eot);
                if (row.aoi !== '' && aoi > 20) { showStatus(`AOI cannot exceed 20 for ${row.studentId}`, 'error'); hasError = true; }
                if (row.eot !== '' && eot > 80) { showStatus(`EOT cannot exceed 80 for ${row.studentId}`, 'error'); hasError = true; }
            }
            if (hasError) return;

            const valid = scoreRows.filter(r => 
                r.studentId && r.studentId.trim() && 
                (r.aoi !== '' || r.eot !== '') &&
                (!isNaN(parseFloat(r.aoi)) || !isNaN(parseFloat(r.eot)))
            );

            if (valid.length === 0) { showStatus('Please add scores for at least one student.', 'error'); return; }

            const scores = valid.map(r => ({
                studentId: r.studentId.trim(),
                studentName: r.studentName.trim(),
                aoi: r.aoi !== '' ? parseFloat(r.aoi) : null,
                eot: r.eot !== '' ? parseFloat(r.eot) : null,
                teacherInitials: teacherInitials
            }));

            const formData = new URLSearchParams();
            formData.append('action', 'postScores');
            formData.append('sheetId', sheetId);
            formData.append('subject', subject);
            formData.append('scores', JSON.stringify(scores));
            formData.append('timestamp', new Date().toISOString());

            const submitBtn = document.getElementById('scoreSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Posting...';
            showStatus('Posting scores...', 'info');
            document.getElementById('loadingSpinner').classList.add('active');

            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                document.getElementById('loadingSpinner').classList.remove('active');
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Post Scores';

                if (result.success) {
                    const data = result.data || {};
                    document.getElementById('scoresForm').style.display = 'none';
                    document.getElementById('scoreSuccess').style.display = 'block';
                    document.getElementById('scoreSuccessMsg').textContent = `Scores posted to "${subject}" for ${cls}! (${data.added || 0} new, ${data.updated || 0} updated)`;
                    scoreRows = [];
                    scoreRowsBackup = [];
                    renderScoreTable();
                    updateScoreSummary();
                    saveScoresSettings();
                    showStatus('', '');
                    updateDashboard();
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                document.getElementById('loadingSpinner').classList.remove('active');
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Post Scores';
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        // ============================================================
        // REPORT CARD FUNCTIONS
        // ============================================================
        function getGradeLetter(score) {
            const s = parseFloat(score);
            if (isNaN(s)) return '-';
            if (s >= 2.7) return 'A';
            if (s >= 2.1) return 'B';
            if (s >= 1.5) return 'C';
            if (s >= 0.9) return 'D';
            return 'E';
        }

        function getAchievementLevel(score) {
            const s = parseFloat(score);
            if (isNaN(s)) return 'NO DATA';
            if (s >= 2.7) return 'OUTSTANDING';
            if (s >= 2.1) return 'SATISFACTORY';
            if (s >= 1.5) return 'SATISFACTORY';
            if (s >= 0.9) return 'BASIC';
            return 'ELEMENTARY';
        }

        function findColumnIndex(headers, patterns) {
            const lowerHeaders = headers.map(h => h.toString().toLowerCase().trim());
            for (const pattern of patterns) {
                const lowerPattern = pattern.toLowerCase().trim();
                let idx = lowerHeaders.indexOf(lowerPattern);
                if (idx !== -1) return idx;
                idx = lowerHeaders.findIndex(h => h.includes(lowerPattern));
                if (idx !== -1) return idx;
                const cleanPattern = lowerPattern.replace(/[^a-z0-9]/g, '');
                idx = lowerHeaders.findIndex(h => h.replace(/[^a-z0-9]/g, '') === cleanPattern);
                if (idx !== -1) return idx;
            }
            return -1;
        }

        function processSheetData(sheetData) {
            let masterData = null;
            let subjectSheets = [];

            for (const [name, data] of Object.entries(sheetData)) {
                if (!data || data.length < 2) continue;
                const headers = data[0];
                
                const studentIdIdx = findColumnIndex(headers, ['studentid', 'student id', 'id']);
                const nameIdx = findColumnIndex(headers, ['name', 'student name']);
                const aoiIdx = findColumnIndex(headers, ['aoi', 'aoi score']);
                const eotIdx = findColumnIndex(headers, ['eot', 'eot score']);
                const teacherIdx = findColumnIndex(headers, ['teacher', 'initials', 'teacher initials']);
                
                if (studentIdIdx !== -1 && nameIdx !== -1) {
                    masterData = { name, data, studentIdIdx, nameIdx };
                } else if (studentIdIdx !== -1 && aoiIdx !== -1 && eotIdx !== -1) {
                    subjectSheets.push({ name, data, studentIdIdx, aoiIdx, eotIdx, teacherIdx });
                }
            }

            if (!masterData) throw new Error('Master sheet not found!');
            if (subjectSheets.length === 0) throw new Error('No subject sheets found!');

            return buildReportData(masterData, subjectSheets);
        }

        function buildReportData(masterData, subjectSheets) {
            const { data: masterRows, studentIdIdx, nameIdx } = masterData;

            const students = masterRows.slice(1)
                .filter(row => row[studentIdIdx] && row[studentIdIdx].toString().trim())
                .map(row => ({
                    id: row[studentIdIdx].toString().trim(),
                    name: row[nameIdx] ? row[nameIdx].toString().trim() : 'Unknown'
                }));

            const subjectData = {};
            subjectSheets.forEach(sheet => {
                const { name, data: rows, studentIdIdx, aoiIdx, eotIdx, teacherIdx } = sheet;
                subjectData[name] = rows.slice(1)
                    .filter(row => row[studentIdIdx] && row[studentIdIdx].toString().trim())
                    .map(row => ({
                        studentId: row[studentIdIdx].toString().trim(),
                        aoi: parseFloat(row[aoiIdx]) || 0,
                        eot: parseFloat(row[eotIdx]) || 0,
                        teacherInitials: teacherIdx !== -1 && row[teacherIdx] ? row[teacherIdx].toString().trim() : ''
                    }));
            });

            const subjectNames = Object.keys(subjectData);
            
            return students.map(student => {
                const subjects = [];
                let totalPercentage = 0;
                let count = 0;
                let hasAoi = false;

                subjectNames.forEach(subject => {
                    const rows = subjectData[subject] || [];
                    const studentRow = rows.find(r => 
                        r.studentId.toLowerCase() === student.id.toLowerCase()
                    );

                    if (studentRow && studentRow.aoi >= 0 && studentRow.eot >= 0) {
                        const total = studentRow.aoi + studentRow.eot;
                        const percentage = total;
                        const score = (total / 100) * 3;
                        const grade = getGradeLetter(score);
                        const achievement = getAchievementLevel(score);
                        
                        if (studentRow.aoi > 0) hasAoi = true;
                        
                        subjects.push({
                            name: subject,
                            aoi: studentRow.aoi,
                            eot: studentRow.eot,
                            percentage: percentage,
                            score: score,
                            grade: grade,
                            achievement: achievement,
                            teacherInitials: studentRow.teacherInitials || ''
                        });
                        totalPercentage += percentage;
                        count++;
                    } else if (studentRow && studentRow.aoi >= 0) {
                        const percentage = (studentRow.aoi / 20) * 100;
                        const score = (studentRow.aoi / 20) * 3;
                        const grade = getGradeLetter(score);
                        const achievement = getAchievementLevel(score);
                        
                        hasAoi = true;
                        
                        subjects.push({
                            name: subject,
                            aoi: studentRow.aoi,
                            eot: '-',
                            percentage: percentage,
                            score: score,
                            grade: grade,
                            achievement: achievement,
                            teacherInitials: studentRow.teacherInitials || ''
                        });
                        totalPercentage += percentage;
                        count++;
                    } else {
                        subjects.push({
                            name: subject,
                            aoi: '-',
                            eot: '-',
                            percentage: 0,
                            score: 0,
                            grade: '-',
                            achievement: 'NOT TAKEN',
                            teacherInitials: ''
                        });
                    }
                });

                const avgPercentage = count > 0 ? totalPercentage / count : 0;
                const avgScore = (avgPercentage / 100) * 3;

                return {
                    ...student,
                    subjects: subjects,
                    avgPercentage: avgPercentage,
                    avgScore: avgScore,
                    avgGrade: count > 0 ? getGradeLetter(avgScore) : '-',
                    avgAchievement: count > 0 ? getAchievementLevel(avgScore) : 'NO DATA',
                    subjectCount: count,
                    totalSubjects: subjectNames.length,
                    totalPercentage: totalPercentage,
                    hasAoi: hasAoi
                };
            });
        }

        // ============================================================
        // LOAD MINI REPORTS
        // ============================================================
        async function loadMiniReports() {
            const cls = document.getElementById('miniClassSelect').value;
            const sheetId = getClassSheetId(cls);
            const scriptUrl = getDataScriptUrl();
            
            if (!cls) { showStatus('Please select a class.', 'error'); return; }
            if (!sheetId) { showStatus('Class link not configured in Settings.', 'error'); return; }

            const loadingDiv = document.getElementById('miniLoading');
            const resultsDiv = document.getElementById('miniResults');
            resultsDiv.innerHTML = '';
            loadingDiv.style.display = 'block';
            showStatus('📋 Loading mini reports for ' + cls + '...', 'info');

            try {
                const formData = new URLSearchParams();
                formData.append('action', 'getAllData');
                formData.append('sheetId', sheetId);

                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });

                const result = await response.json();
                loadingDiv.style.display = 'none';

                if (result.success && result.data) {
                    const sheetData = result.data.sheetData || {};
                    const reportData = processSheetData(sheetData);
                    miniReportData = reportData;
                    displayMiniReports(reportData);
                    showStatus(`✅ Found ${reportData.length} students in ${cls}`, 'success');
                    updateDashboard();
                    localStorage.setItem('miniClass', cls);
                } else {
                    showStatus('❌ ' + (result.message || 'Failed to fetch data'), 'error');
                    resultsDiv.innerHTML = `<div style="padding:20px;background:#fff5f5;border-radius:10px;"><p style="color:#e53e3e;font-weight:bold;">❌ ${result.message || 'Failed to fetch data'}</p></div>`;
                }
            } catch (error) {
                loadingDiv.style.display = 'none';
                showStatus('❌ Error: ' + error.message, 'error');
                resultsDiv.innerHTML = `<div style="padding:20px;background:#fff5f5;border-radius:10px;"><p style="color:#e53e3e;font-weight:bold;">❌ ${error.message}</p></div>`;
            }
        }

        function filterMiniReports() {
            const searchTerm = document.getElementById('miniSearchInput').value.toLowerCase().trim();
            const resultsDiv = document.getElementById('miniResults');
            if (!searchTerm) {
                displayMiniReports(miniReportData);
                return;
            }
            const filtered = miniReportData.filter(s => 
                s.id.toLowerCase().includes(searchTerm) || 
                s.name.toLowerCase().includes(searchTerm)
            );
            displayMiniReports(filtered);
        }

        function displayMiniReports(reportData) {
            const resultsDiv = document.getElementById('miniResults');
            const schoolName = document.getElementById('settingsSchoolName').value || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const cls = document.getElementById('miniClassSelect').value || 'S.2';
            const term = document.getElementById('settingsTerm').value || 'III';
            const year = document.getElementById('settingsYear').value || '2025';
            const badgeSaved = localStorage.getItem('reportCardBadge');
            
            if (reportData.length === 0) {
                resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:#666;">No students found in this class.</p>';
                return;
            }

            let html = '<div class="mini-report-card-container">';

            reportData.forEach((student) => {
                const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
                const hasData = student.subjectCount > 0;
                const hasAoi = student.hasAoi || false;
                
                let photoHTML = '';
                let photoData = studentPhotos[student.name];
                if (!photoData) {
                    const matchKey = Object.keys(studentPhotos).find(key => 
                        key.toLowerCase() === student.name.toLowerCase()
                    );
                    if (matchKey) photoData = studentPhotos[matchKey];
                }
                photoHTML = photoData ? `<img src="${photoData}" />` : `<span class="mini-no-photo">No<br/>Photo</span>`;

                const watermarkHTML = badgeSaved ? 
                    `<div class="mini-watermark"><img src="${badgeSaved}" /></div>` :
                    `<div class="mini-watermark-text">${schoolName.split(' ').map(w => w[0]).join('')}</div>`;

                html += `
                <div class="mini-report-card">
                    ${watermarkHTML}
                    <div class="mini-school">${schoolName}</div>
                    <div class="mini-photo">${photoHTML}</div>
                    <div class="mini-student">${student.name}</div>
                    <div class="mini-meta">
                        <span>ID: ${student.id}</span>
                        <span>Class: ${cls}</span>
                        <span>Term: ${term}</span>
                        <span>Year: ${year}</span>
                        <span>Initials: ${initials}</span>
                    </div>
                    <div class="mini-subjects">
                        ${student.subjects.filter(s => s.aoi !== '-').map(subj => `
                            <div class="mini-subject">
                                <span class="mini-subj-name">${subj.name}</span>
                                <span>
                                    <span class="mini-subj-score">${hasAoi ? 'AOI: ' + subj.aoi : ''} ${subj.eot !== '-' ? '| EOT: ' + subj.eot : ''}</span>
                                    <span class="mini-subj-grade grade-${subj.grade.toLowerCase()}">${subj.grade}</span>
                                    ${subj.teacherInitials ? `<span style="font-size:10px;color:#888;margin-left:5px;">(${subj.teacherInitials})</span>` : ''}
                                </span>
                            </div>
                        `).join('')}
                        ${!hasData ? '<div style="text-align:center;color:#999;padding:10px;font-size:13px;">No scores available</div>' : ''}
                    </div>
                    <div class="mini-total">
                        <span>Average: ${hasData ? student.avgPercentage.toFixed(0) + '%' : '---'}</span>
                        <span>Grade: ${hasData ? student.avgGrade : '---'}</span>
                    </div>
                    <div class="mini-achievement">${hasData ? '🏆 ' + student.avgAchievement : 'No Data'}</div>
                    <div class="mini-footer">📱 Sent via EduTrack | Powered by His Grace Technologies</div>
                </div>
                `;
            });

            html += '</div>';
            resultsDiv.innerHTML = html;
        }

        function printMiniReports() {
            window.print();
        }

        function downloadMiniReportsPDF() {
            if (miniReportData.length === 0) {
                showStatus('Please load mini reports first.', 'warning');
                return;
            }
            
            const schoolName = document.getElementById('settingsSchoolName').value || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const schoolMotto = document.getElementById('settingsSchoolMotto').value || '"A PEN PAYS"';
            const schoolAddress = document.getElementById('settingsSchoolAddress').value || 'P.O. BOX 1388, SSEMBABULE';
            const schoolPhone = document.getElementById('settingsSchoolPhone').value || '0776 685942';
            const cls = document.getElementById('miniClassSelect').value || 'S.2';
            const term = document.getElementById('settingsTerm').value || 'III';
            const year = document.getElementById('settingsYear').value || '2025';
            const badgeSaved = localStorage.getItem('reportCardBadge');
            
            let html = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>Mini Reports - ${cls}</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; padding: 20px; background: white; }
                .mini-report-card {
                    border: 2px solid #1a1a2e;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 15px auto;
                    page-break-inside: avoid;
                    position: relative;
                    overflow: hidden;
                    max-width: 350px;
                    display: inline-block;
                    vertical-align: top;
                    width: 320px;
                    background: white;
                }
                .mini-watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-30deg);
                    opacity: 0.04;
                    pointer-events: none;
                    z-index: 0;
                    width: 200px;
                    height: 200px;
                }
                .mini-watermark img { width: 100%; height: 100%; object-fit: contain; }
                .mini-watermark-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-30deg);
                    opacity: 0.04;
                    font-size: 40px;
                    font-weight: 700;
                    color: #1a1a2e;
                    pointer-events: none;
                    z-index: 0;
                    letter-spacing: 10px;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .mini-report-card > * { position: relative; z-index: 1; }
                .mini-school { font-size: 14px; font-weight: 700; text-align: center; color: #1a1a2e; text-transform: uppercase; border-bottom: 2px double #1a1a2e; padding-bottom: 5px; margin-bottom: 8px; letter-spacing: 1px; }
                .mini-student { text-align: center; font-size: 16px; font-weight: 700; color: #0f3460; margin-bottom: 3px; }
                .mini-meta { text-align: center; font-size: 11px; color: #666; margin-bottom: 8px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
                .mini-subjects { margin: 8px 0; }
                .mini-subject { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e0e0e0; font-size: 13px; }
                .mini-subject:last-child { border-bottom: none; }
                .mini-subj-name { font-weight: 500; color: #333; }
                .mini-subj-score { font-weight: 600; color: #0f3460; }
                .mini-subj-grade { font-weight: 700; margin-left: 5px; }
                .grade-a { color: #2d6a4f; }
                .grade-b { color: #0f3460; }
                .grade-c { color: #e85d04; }
                .grade-d { color: #c1121f; }
                .grade-e { color: #780000; }
                .mini-total { display: flex; justify-content: space-between; padding: 6px 0 3px 0; border-top: 2px solid #1a1a2e; margin-top: 5px; font-weight: 700; font-size: 14px; color: #1a1a2e; }
                .mini-achievement { text-align: center; font-size: 11px; font-weight: 600; color: #0f3460; margin-top: 4px; padding: 3px 8px; background: #f0f4ff; border-radius: 12px; display: inline-block; width: 100%; }
                .mini-footer { text-align: center; font-size: 9px; color: #999; margin-top: 8px; border-top: 1px solid #e0e0e0; padding-top: 5px; }
                .mini-photo { width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #0f3460; margin: 0 auto 5px auto; background: #f8f9fa; display: flex; align-items: center; justify-content: center; }
                .mini-photo img { width: 100%; height: 100%; object-fit: cover; }
                .mini-no-photo { font-size: 8px; color: #999; text-align: center; }
                .school-header-pdf { text-align: center; margin-bottom: 20px; }
                .school-header-pdf .school-name-pdf { font-size: 22px; font-weight: 700; text-transform: uppercase; }
                .school-header-pdf .school-details-pdf { font-size: 13px; color: #555; }
                .school-header-pdf .motto-pdf { font-style: italic; font-size: 14px; color: #555; }
                .school-header-pdf .badge-pdf { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 2px solid #1a1a2e; margin: 0 auto 5px auto; background: #f8f9fa; display: flex; align-items: center; justify-content: center; }
                .school-header-pdf .badge-pdf img { width: 100%; height: 100%; object-fit: contain; }
                @media print { .mini-report-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none; border: 1px solid #000; margin: 5px; padding: 15px; } }
            </style>
            </head>
            <body>
            <div class="school-header-pdf">
                <div class="badge-pdf">${badgeSaved ? `<img src="${badgeSaved}" />` : '<span style="font-size:24px;">🏫</span>'}</div>
                <div class="school-name-pdf">${schoolName}</div>
                <div class="school-details-pdf">${schoolAddress}</div>
                <div class="school-details-pdf">📞 ${schoolPhone}</div>
                <div class="motto-pdf">${schoolMotto}</div>
                <div style="margin-top:5px;font-size:14px;font-weight:600;color:#0f3460;">📄 Mini Report Cards - ${cls} | ${term} | ${year}</div>
                <div style="font-size:12px;color:#888;">Generated: ${new Date().toLocaleString()}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;">
            `;

            miniReportData.forEach((student) => {
                const hasData = student.subjectCount > 0;
                const hasAoi = student.hasAoi || false;
                const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
                const watermarkHTML = badgeSaved ? 
                    `<div class="mini-watermark"><img src="${badgeSaved}" /></div>` :
                    `<div class="mini-watermark-text">${schoolName.split(' ').map(w => w[0]).join('')}</div>`;

                html += `
                <div class="mini-report-card">
                    ${watermarkHTML}
                    <div class="mini-school">${schoolName}</div>
                    <div class="mini-student">${student.name}</div>
                    <div class="mini-meta">
                        <span>ID: ${student.id}</span>
                        <span>Class: ${cls}</span>
                        <span>Initials: ${initials}</span>
                    </div>
                    <div class="mini-subjects">
                        ${student.subjects.filter(s => s.aoi !== '-').map(subj => `
                            <div class="mini-subject">
                                <span class="mini-subj-name">${subj.name}</span>
                                <span>
                                    <span class="mini-subj-score">${hasAoi ? 'AOI: ' + subj.aoi : ''} ${subj.eot !== '-' ? '| EOT: ' + subj.eot : ''}</span>
                                    <span class="mini-subj-grade grade-${subj.grade.toLowerCase()}">${subj.grade}</span>
                                    ${subj.teacherInitials ? `<span style="font-size:10px;color:#888;margin-left:5px;">(${subj.teacherInitials})</span>` : ''}
                                </span>
                            </div>
                        `).join('')}
                        ${!hasData ? '<div style="text-align:center;color:#999;padding:10px;font-size:13px;">No scores available</div>' : ''}
                    </div>
                    <div class="mini-total">
                        <span>Average: ${hasData ? student.avgPercentage.toFixed(0) + '%' : '---'}</span>
                        <span>Grade: ${hasData ? student.avgGrade : '---'}</span>
                    </div>
                    <div class="mini-achievement">${hasData ? '🏆 ' + student.avgAchievement : 'No Data'}</div>
                    <div class="mini-footer">📱 Sent via EduTrack | Powered by His Grace Technologies</div>
                </div>
                `;
            });

            html += `</div></body></html>`;

            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MiniReports_${cls}_${new Date().toISOString().split('T')[0]}.html`;
            a.click();
            URL.revokeObjectURL(url);
            showStatus('✅ Mini reports downloaded successfully!', 'success');
        }

        // ============================================================
        // FULL REPORTS - A4 OPTIMIZED
        // ============================================================
        async function fetchReportData() {
            const cls = document.getElementById('reportClassSelect').value;
            const sheetId = getClassSheetId(cls);
            const scriptUrl = getDataScriptUrl();
            
            if (!cls) { showStatus('Please select a class.', 'error'); return; }
            if (!sheetId) { showStatus('Class link not configured in Settings.', 'error'); return; }

            const loadingDiv = document.getElementById('reportLoading');
            const resultsDiv = document.getElementById('reportResults');
            resultsDiv.innerHTML = '';
            loadingDiv.style.display = 'block';
            showStatus('📋 Fetching report data for ' + cls + '...', 'info');

            try {
                const formData = new URLSearchParams();
                formData.append('action', 'getAllData');
                formData.append('sheetId', sheetId);

                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });

                const result = await response.json();
                loadingDiv.style.display = 'none';

                if (result.success && result.data) {
                    const sheetData = result.data.sheetData || {};
                    const reportData = processSheetData(sheetData);
                    allReportData = reportData;
                    displayFullReports(reportData);
                    showStatus(`✅ Found ${reportData.length} students in ${cls}`, 'success');
                    updateDashboard();
                    localStorage.setItem('reportClass', cls);
                } else {
                    showStatus('❌ ' + (result.message || 'Failed to fetch data'), 'error');
                    resultsDiv.innerHTML = `<div style="padding:20px;background:#fff5f5;border-radius:10px;"><p style="color:#e53e3e;font-weight:bold;">❌ ${result.message || 'Failed to fetch data'}</p></div>`;
                }
            } catch (error) {
                loadingDiv.style.display = 'none';
                showStatus('❌ Error: ' + error.message, 'error');
                resultsDiv.innerHTML = `<div style="padding:20px;background:#fff5f5;border-radius:10px;"><p style="color:#e53e3e;font-weight:bold;">❌ ${error.message}</p></div>`;
            }
        }

        function searchStudent() {
            const searchTerm = document.getElementById('searchInput').value.trim();
            if (!searchTerm) { showStatus('Please enter a Student ID or Name', 'error'); return; }
            if (allReportData.length === 0) {
                showStatus('Loading data first...', 'info');
                fetchReportData().then(() => filterFullReports(searchTerm));
            } else {
                filterFullReports(searchTerm);
            }
        }

        function filterFullReports(searchTerm) {
            const filtered = allReportData.filter(s => 
                s.id === searchTerm || 
                s.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filtered.length === 0) {
                document.getElementById('reportResults').innerHTML = `
                    <div style="padding:20px;background:#fff5f5;border-radius:10px;">
                        <p style="color:#e53e3e;font-weight:bold;">❌ No students found for "${searchTerm}"</p>
                    </div>
                `;
            } else {
                displayFullReports(filtered);
                showStatus(`✅ Found ${filtered.length} student(s)`, 'success');
            }
        }

        function displayFullReports(reportData) {
            const resultsDiv = document.getElementById('reportResults');
            const schoolName = document.getElementById('settingsSchoolName').value || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const schoolMotto = document.getElementById('settingsSchoolMotto').value || '"A PEN PAYS"';
            const schoolAddress = document.getElementById('settingsSchoolAddress').value || 'P.O. BOX 1388, SSEMBABULE';
            const schoolPhone = document.getElementById('settingsSchoolPhone').value || '0776 685942';
            const term = document.getElementById('settingsTerm').value || 'III';
            const year = document.getElementById('settingsYear').value || '2025';
            const cls = document.getElementById('reportClassSelect').value || 'S.2';
            
            const badgeSaved = localStorage.getItem('reportCardBadge');
            const badgeHTML = badgeSaved ? `<img src="${badgeSaved}" />` : `<span style="font-size:10px;color:#999;">Badge</span>`;
            const watermarkHTML = badgeSaved ? 
                `<div class="watermark"><img src="${badgeSaved}" /></div>` :
                `<div class="watermark-text">${schoolName.split(' ').map(w => w[0]).join('')}</div>`;

            if (reportData.length === 0) {
                resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:#666;">No students found.</p>';
                return;
            }

            let html = '<div class="report-card-container">';

            reportData.forEach((student) => {
                const hasData = student.subjectCount > 0;
                const totalPercentageSum = student.totalPercentage || 0;
                const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
                
                let photoHTML = '';
                let photoData = studentPhotos[student.name];
                if (!photoData) {
                    const matchKey = Object.keys(studentPhotos).find(key => 
                        key.toLowerCase() === student.name.toLowerCase()
                    );
                    if (matchKey) photoData = studentPhotos[matchKey];
                }
                photoHTML = photoData ? `<img src="${photoData}" />` : `<span class="no-photo">No<br/>Photo</span>`;

                html += `
                <div class="report-card">
                    ${watermarkHTML}
                    <div class="school-header">
                        <div class="badge">${badgeHTML}</div>
                        <div class="school-info">
                            <div class="school-name">${schoolName}</div>
                            <div class="school-details">${schoolAddress}</div>
                            <div class="school-details">📞 ${schoolPhone}</div>
                            <div class="motto">${schoolMotto}</div>
                        </div>
                    </div>
                    <div class="report-title">📋 TERMINAL ASSESSMENT REPORT</div>
                    <div class="student-info-grid">
                        <div class="info-left">
                            <div class="info-item"><strong>STUDENT'S NAME:</strong> <span class="value">${student.name}</span></div>
                            <div class="info-item"><strong>INITIALS:</strong> <span class="value">${initials}</span></div>
                            <div class="info-item"><strong>TERM:</strong> <span class="value">${term}</span></div>
                            <div class="info-item"><strong>YEAR:</strong> <span class="value">${year}</span></div>
                            <div class="info-item"><strong>COMPUTER NUMBER:</strong> <span class="value">${student.id}</span></div>
                            <div class="info-item"><strong>CLASS:</strong> <span class="value">${cls}</span></div>
                        </div>
                        <div class="student-photo">${photoHTML}</div>
                    </div>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width:16%;">SUBJECTS</th>
                                <th style="width:9%;">AOI</th>
                                <th style="width:9%;">EOT</th>
                                <th style="width:11%;">TOTAL (%)</th>
                                <th style="width:11%;">SCORE</th>
                                <th style="width:9%;">GRADE</th>
                                <th style="width:20%;">ACHIEVEMENT LEVEL</th>
                                <th style="width:10%;">INITIALS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${student.subjects.map(subj => `
                                <tr>
                                    <td class="subject-cell">${subj.name}</td>
                                    <td>${subj.aoi}</td>
                                    <td>${subj.eot}</td>
                                    <td>${subj.percentage.toFixed(0)}</td>
                                    <td class="score-cell">${subj.score.toFixed(2)}</td>
                                    <td><strong>${subj.grade}</strong></td>
                                    <td>${subj.achievement}</td>
                                    <td class="teacher-initials-col">${subj.teacherInitials || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td style="text-align:left;padding-left:10px;">TOTAL</td>
                                <td>-</td>
                                <td>-</td>
                                <td>${hasData ? totalPercentageSum.toFixed(0) : '-'}</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div class="report-summary-grid">
                        <div class="summary-item"><strong>AVERAGE</strong><div class="value">${hasData ? student.avgPercentage.toFixed(0) + '%' : '---'}</div></div>
                        <div class="summary-item"><strong>AVG SCORE</strong><div class="value">${hasData ? student.avgScore.toFixed(2) : '---'}</div></div>
                        <div class="summary-item"><strong>AVG GRADE</strong><div class="value">${hasData ? student.avgGrade : '---'}</div></div>
                        <div class="summary-item"><strong>ACHIEVEMENT</strong><div class="value" style="font-size:15px;">${hasData ? student.avgAchievement : 'NO DATA'}</div></div>
                    </div>
                    <div class="grading-scale-compact">
                        <div class="grade-item"><div class="grade-letter">A</div><div class="score-range">2.7 - 3.0</div><div class="grade-level">OUTSTANDING</div></div>
                        <div class="grade-item"><div class="grade-letter">B</div><div class="score-range">2.1 - 2.6</div><div class="grade-level">SATISFACTORY</div></div>
                        <div class="grade-item"><div class="grade-letter">C</div><div class="score-range">1.5 - 2.0</div><div class="grade-level">SATISFACTORY</div></div>
                        <div class="grade-item"><div class="grade-letter">D</div><div class="score-range">0.9 - 1.4</div><div class="grade-level">BASIC</div></div>
                        <div class="grade-item"><div class="grade-letter">E</div><div class="score-range">0.0 - 0.8</div><div class="grade-level">ELEMENTARY</div></div>
                    </div>
                    <div class="comments-section-compact">
                        <div class="comment-line"><strong>Class Teachers' Comments:</strong> <span style="flex:1;font-style:italic;color:#555;">${hasData ? (student.avgScore >= 2.1 ? 'Good performance, keep it up!' : 'Basic performance, more efforts still needed') : 'No data available'}</span></div>
                        <div class="comment-line"><strong>SIGNATURE:</strong><span class="line"></span><strong>TEACHER'S NAME:</strong><span class="line"></span></div>
                        <div class="comment-line"><strong>School Fees Balance:</strong><span class="line"></span></div>
                        <div class="comment-line"><strong>Next Term Begins on:</strong><span class="line"></span></div>
                    </div>
                    <div class="report-footer-compact">
                        <div style="font-size:10px;color:#888;">This Report Card is ONLY valid when it bears a School Stamp</div>
                        <div class="stamp-note">📌 SCHOOL STAMP</div>
                        <button class="whatsapp-btn" onclick="shareOnWhatsApp(${JSON.stringify(student).replace(/"/g, '&quot;')})">📱 Share via WhatsApp</button>
                    </div>
                </div>
                <br>`;
            });

            html += `<div style="text-align:center;margin-top:20px;no-print">
                <button onclick="window.print()" class="btn btn-primary">🖨️ Print All</button>
                <button onclick="downloadMarkSheet()" class="btn btn-warning">📥 Download Marks</button>
                <button onclick="downloadAllReportCardsPDF()" class="btn btn-danger">📥 Download PDF</button>
            </div>`;
            html += '</div>';
            resultsDiv.innerHTML = html;
        }

        function shareOnWhatsApp(student) {
            const schoolName = document.getElementById('settingsSchoolName').value || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const cls = document.getElementById('reportClassSelect').value || 'S.2';
            const term = document.getElementById('settingsTerm').value || 'III';
            const year = document.getElementById('settingsYear').value || '2025';
            
            let message = `📊 *REPORT CARD* 📊\n`;
            message += `🏫 ${schoolName}\n`;
            message += `👨‍🎓 Student: ${student.name}\n`;
            message += `🆔 ID: ${student.id}\n`;
            message += `📋 Class: ${cls}\n`;
            message += `📅 Term: ${term}\n`;
            message += `📆 Year: ${year}\n`;
            message += `━━━━━━━━━━━━━━━━\n`;
            
            student.subjects.forEach(subj => {
                if (subj.aoi !== '-') {
                    message += `📚 ${subj.name}\n`;
                    message += `   AOI: ${subj.aoi} | EOT: ${subj.eot}\n`;
                    message += `   Score: ${subj.score.toFixed(2)} | Grade: ${subj.grade}\n`;
                    message += `   ${subj.achievement}\n`;
                    if (subj.teacherInitials) message += `   Teacher: ${subj.teacherInitials}\n`;
                    message += `━━━━━━━━━━━━━━━━\n`;
                }
            });
            
            message += `📊 Average: ${student.avgPercentage.toFixed(0)}%\n`;
            message += `⭐ Grade: ${student.avgGrade}\n`;
            message += `🏆 Achievement: ${student.avgAchievement}\n`;
            message += `━━━━━━━━━━━━━━━━\n`;
            message += `📱 Sent via EduTrack System\n`;
            message += `Powered by His Grace Technologies`;
            
            const encodedMessage = encodeURIComponent(message);
            window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
        }

        function downloadMarkSheet() {
            if (allReportData.length === 0) { showStatus('Please load data first.', 'warning'); return; }
            
            const schoolName = document.getElementById('settingsSchoolName').value || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const schoolMotto = document.getElementById('settingsSchoolMotto').value || '"A PEN PAYS"';
            const schoolAddress = document.getElementById('settingsSchoolAddress').value || 'P.O. BOX 1388, SSEMBABULE';
            const schoolPhone = document.getElementById('settingsSchoolPhone').value || '0776 685942';
            const cls = document.getElementById('reportClassSelect').value || 'S.2';
            const term = document.getElementById('settingsTerm').value || 'III';
            const year = document.getElementById('settingsYear').value || '2025';
            
            let csv = `"${schoolName}"\n"${schoolAddress}"\n"Phone: ${schoolPhone}"\n"${schoolMotto}"\n"Class: ${cls} | Term: ${term} | Year: ${year}"\n"Generated: ${new Date().toLocaleString()}"\n\n`;
            
            let headers = 'Student ID,Student Name';
            const subjects = new Set();
            allReportData.forEach(student => {
                student.subjects.forEach(subj => {
                    if (subj.aoi !== '-') subjects.add(subj.name);
                });
            });
            subjects.forEach(subj => {
                headers += `,${subj} (AOI),${subj} (EOT),${subj} (Score),${subj} (Grade),${subj} (Teacher)`;
            });
            headers += ',Average Score,Average Grade,Achievement\n';
            csv += headers;
            
            allReportData.forEach(student => {
                let row = `${student.id},${student.name}`;
                subjects.forEach(subj => {
                    const found = student.subjects.find(s => s.name === subj && s.aoi !== '-');
                    if (found) {
                        row += `,${found.aoi},${found.eot},${found.score.toFixed(2)},${found.grade},${found.teacherInitials || ''}`;
                    } else {
                        row += ',,,,,';
                    }
                });
                row += `,${student.avgPercentage.toFixed(0)}%,${student.avgGrade},${student.avgAchievement}\n`;
                csv += row;
            });
            
            csv += `\n"Developed by EDUTOK | Powered by His Grace Technologies"`;
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MarkSheet_${cls}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showStatus('✅ Mark sheet downloaded successfully!', 'success');
        }

        function downloadAllReportCardsPDF() {
            if (allReportData.length === 0) { showStatus('Please load data first.', 'warning'); return; }
            
            const schoolName = document.getElementById('settingsSchoolName').value || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const schoolMotto = document.getElementById('settingsSchoolMotto').value || '"A PEN PAYS"';
            const schoolAddress = document.getElementById('settingsSchoolAddress').value || 'P.O. BOX 1388, SSEMBABULE';
            const schoolPhone = document.getElementById('settingsSchoolPhone').value || '0776 685942';
            const term = document.getElementById('settingsTerm').value || 'III';
            const year = document.getElementById('settingsYear').value || '2025';
            const cls = document.getElementById('reportClassSelect').value || 'S.2';
            const badgeSaved = localStorage.getItem('reportCardBadge');
            
            let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Cards - ${cls}</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; padding: 20px; background: white; }
                .report-card { 
                    border: 2px solid #000; 
                    padding: 20px 25px; 
                    margin-bottom: 25px; 
                    page-break-after: always;
                    background: white;
                    position: relative;
                    overflow: hidden;
                    max-width: 1100px;
                    margin: 0 auto 15px auto;
                }
                .watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-30deg);
                    opacity: 0.05;
                    pointer-events: none;
                    z-index: 0;
                    width: 250px;
                    height: 250px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .watermark img { width: 100%; height: 100%; object-fit: contain; opacity: 0.5; }
                .watermark-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-30deg);
                    opacity: 0.04;
                    font-size: 60px;
                    font-weight: 700;
                    color: #1a1a2e;
                    pointer-events: none;
                    z-index: 0;
                    letter-spacing: 12px;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .report-card > * { position: relative; z-index: 1; }
                .school-header { display: flex; align-items: center; justify-content: center; gap: 15px; border-bottom: 2px double #000; padding-bottom: 8px; margin-bottom: 10px; }
                .school-name { font-size: 20px; font-weight: 700; text-transform: uppercase; }
                .motto { font-style: italic; font-size: 12px; color: #555; }
                .report-title { text-align: center; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0 10px 0; }
                .student-info { border: 1px solid #000; padding: 8px 12px; margin-bottom: 10px; background: #fafafa; display: grid; grid-template-columns: 2fr 1fr; gap: 10px; font-size: 12px; }
                .student-info .info-left { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 15px; }
                .student-info .info-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }
                .student-info .info-item strong { min-width: 80px; font-size: 11px; }
                .student-info .info-item .value { border-bottom: 1px dotted #999; padding: 0 8px; }
                .student-photo { width: 65px; height: 65px; border: 1px solid #ddd; border-radius: 50%; overflow: hidden; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: #f8f9fa; }
                .student-photo img { width: 100%; height: 100%; object-fit: cover; }
                table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10.5px; }
                th { background: #1a1a2e; color: white; padding: 4px 3px; text-align: center; border: 1px solid #000; font-size: 9.5px; }
                td { padding: 4px 3px; text-align: center; border: 1px solid #000; font-size: 10.5px; }
                tr:nth-child(even) { background: #f8f9fa; }
                .total-row td { background: #1a1a2e; color: white; font-weight: 700; padding: 4px 3px; font-size: 10.5px; }
                .total-row td:first-child { text-align: left; padding-left: 8px; }
                .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin: 8px 0; padding: 8px 12px; border: 1px solid #000; background: #fafafa; font-size: 11px; }
                .summary-grid .summary-item { text-align: center; padding: 4px; }
                .summary-grid .summary-item strong { display: block; font-size: 10px; color: #555; }
                .summary-grid .summary-item .value { font-size: 15px; font-weight: 700; color: #1a1a2e; }
                .grading-scale { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 3px 10px; margin: 6px 0; padding: 8px 12px; border: 1px solid #000; background: #fafafa; font-size: 10px; text-align: center; }
                .grading-scale .grade-item .score-range { font-size: 9px; color: #555; }
                .grading-scale .grade-item .grade-letter { font-size: 14px; font-weight: 700; color: #1a1a2e; }
                .grading-scale .grade-item .grade-level { font-size: 8px; color: #666; }
                .comments { margin: 6px 0; padding: 8px 12px; border: 1px solid #000; background: #fafafa; font-size: 10.5px; }
                .comment-line { display: flex; align-items: center; gap: 10px; padding: 4px 0; border-bottom: 1px dotted #ddd; }
                .comment-line:last-child { border-bottom: none; }
                .comment-line strong { min-width: 100px; font-size: 10px; }
                .comment-line .line { flex: 1; border-bottom: 1px solid #999; height: 22px; }
                .footer { text-align: center; margin-top: 10px; padding-top: 8px; border-top: 2px solid #000; font-size: 10px; color: #555; }
                .stamp { font-weight: 700; color: #c1121f; margin-top: 3px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                .teacher-init { font-weight: 600; color: #0f3460; font-size: 9px; }
                .school-header-pdf { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1a1a2e; }
                .school-header-pdf .school-name-pdf { font-size: 22px; font-weight: 700; text-transform: uppercase; }
                .school-header-pdf .school-details-pdf { font-size: 13px; color: #555; }
                .school-header-pdf .motto-pdf { font-style: italic; font-size: 14px; color: #555; }
                .school-header-pdf .badge-pdf { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 2px solid #1a1a2e; margin: 0 auto 5px auto; background: #f8f9fa; display: flex; align-items: center; justify-content: center; }
                .school-header-pdf .badge-pdf img { width: 100%; height: 100%; object-fit: contain; }
                .subject-cell { text-align: left; padding-left: 8px; font-weight: 500; }
                @media print { .report-card { break-inside: avoid; page-break-after: always; } }
            </style>
            </head><body>
            <div class="school-header-pdf">
                <div class="badge-pdf">${badgeSaved ? `<img src="${badgeSaved}" />` : '<span style="font-size:24px;">🏫</span>'}</div>
                <div class="school-name-pdf">${schoolName}</div>
                <div class="school-details-pdf">${schoolAddress}</div>
                <div class="school-details-pdf">📞 ${schoolPhone}</div>
                <div class="motto-pdf">${schoolMotto}</div>
                <div style="margin-top:5px;font-size:14px;font-weight:600;color:#0f3460;">📋 Full Report Cards - ${cls} | ${term} | ${year}</div>
                <div style="font-size:12px;color:#888;">Generated: ${new Date().toLocaleString()}</div>
            </div>`;
            
            const watermarkHTML = badgeSaved ? `<div class="watermark"><img src="${badgeSaved}" /></div>` : `<div class="watermark-text">${schoolName.split(' ').map(w => w[0]).join('')}</div>`;
            
            allReportData.forEach(student => {
                const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase();
                const hasData = student.subjectCount > 0;
                const totalPercentageSum = student.totalPercentage || 0;
                
                html += `
                <div class="report-card">
                    ${watermarkHTML}
                    <div class="school-header">
                        <div class="school-name">${schoolName}</div>
                    </div>
                    <div style="text-align:center;font-size:13px;color:#555;">${schoolAddress} | 📞 ${schoolPhone}</div>
                    <div class="motto" style="text-align:center;font-style:italic;font-size:12px;color:#555;margin-bottom:6px;">${schoolMotto}</div>
                    <div class="report-title">📋 TERMINAL ASSESSMENT REPORT</div>
                    <div class="student-info">
                        <div class="info-left">
                            <div class="info-item"><strong>STUDENT'S NAME:</strong> <span class="value">${student.name}</span></div>
                            <div class="info-item"><strong>INITIALS:</strong> <span class="value">${initials}</span></div>
                            <div class="info-item"><strong>TERM:</strong> <span class="value">${term}</span></div>
                            <div class="info-item"><strong>YEAR:</strong> <span class="value">${year}</span></div>
                            <div class="info-item"><strong>COMPUTER NUMBER:</strong> <span class="value">${student.id}</span></div>
                            <div class="info-item"><strong>CLASS:</strong> <span class="value">${cls}</span></div>
                        </div>
                        <div class="student-photo">${badgeSaved ? `<img src="${badgeSaved}" />` : '<span style="font-size:9px;color:#999;">Photo</span>'}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:16%;">SUBJECTS</th>
                                <th style="width:9%;">AOI</th>
                                <th style="width:9%;">EOT</th>
                                <th style="width:11%;">TOTAL (%)</th>
                                <th style="width:11%;">SCORE</th>
                                <th style="width:9%;">GRADE</th>
                                <th style="width:20%;">ACHIEVEMENT LEVEL</th>
                                <th style="width:10%;">INITIALS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${student.subjects.map(subj => `
                                <tr>
                                    <td class="subject-cell">${subj.name}</td>
                                    <td>${subj.aoi}</td>
                                    <td>${subj.eot}</td>
                                    <td>${subj.percentage.toFixed(0)}</td>
                                    <td>${subj.score.toFixed(2)}</td>
                                    <td><strong>${subj.grade}</strong></td>
                                    <td>${subj.achievement}</td>
                                    <td class="teacher-init">${subj.teacherInitials || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td style="text-align:left;padding-left:8px;">TOTAL</td>
                                <td>-</td>
                                <td>-</td>
                                <td>${hasData ? totalPercentageSum.toFixed(0) : '-'}</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div class="summary-grid">
                        <div class="summary-item"><strong>AVERAGE</strong><div class="value">${hasData ? student.avgPercentage.toFixed(0) + '%' : '---'}</div></div>
                        <div class="summary-item"><strong>AVG SCORE</strong><div class="value">${hasData ? student.avgScore.toFixed(2) : '---'}</div></div>
                        <div class="summary-item"><strong>AVG GRADE</strong><div class="value">${hasData ? student.avgGrade : '---'}</div></div>
                        <div class="summary-item"><strong>ACHIEVEMENT</strong><div class="value" style="font-size:13px;">${hasData ? student.avgAchievement : 'NO DATA'}</div></div>
                    </div>
                    <div class="grading-scale">
                        <div class="grade-item"><div class="grade-letter">A</div><div class="score-range">2.7 - 3.0</div><div class="grade-level">OUTSTANDING</div></div>
                        <div class="grade-item"><div class="grade-letter">B</div><div class="score-range">2.1 - 2.6</div><div class="grade-level">SATISFACTORY</div></div>
                        <div class="grade-item"><div class="grade-letter">C</div><div class="score-range">1.5 - 2.0</div><div class="grade-level">SATISFACTORY</div></div>
                        <div class="grade-item"><div class="grade-letter">D</div><div class="score-range">0.9 - 1.4</div><div class="grade-level">BASIC</div></div>
                        <div class="grade-item"><div class="grade-letter">E</div><div class="score-range">0.0 - 0.8</div><div class="grade-level">ELEMENTARY</div></div>
                    </div>
                    <div class="comments">
                        <div class="comment-line"><strong>Class Teachers' Comments:</strong> <span style="flex:1;font-style:italic;">${hasData ? (student.avgScore >= 2.1 ? 'Good performance, keep it up!' : 'Basic performance, more efforts still needed') : 'No data available'}</span></div>
                        <div class="comment-line"><strong>SIGNATURE:</strong><span class="line"></span><strong>TEACHER'S NAME:</strong><span class="line"></span></div>
                        <div class="comment-line"><strong>School Fees Balance:</strong><span class="line"></span></div>
                        <div class="comment-line"><strong>Next Term Begins on:</strong><span class="line"></span></div>
                    </div>
                    <div class="footer">
                        <div style="font-size:10px;color:#888;">This Report Card is ONLY valid when it bears a School Stamp</div>
                        <div class="stamp">📌 SCHOOL STAMP</div>
                    </div>
                </div>
                `;
            });
            
            html += `</body></html>`;
            
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ReportCards_${cls}_${new Date().toISOString().split('T')[0]}.html`;
            a.click();
            URL.revokeObjectURL(url);
            showStatus('✅ All report cards downloaded successfully!', 'success');
        }

        // ============================================================
        // PHOTO UPLOAD
        // ============================================================
        function loadSettingsPhotos() {
            const saved = localStorage.getItem('studentPhotosByName');
            if (saved) {
                try {
                    studentPhotos = JSON.parse(saved);
                    renderSettingsPhotos();
                } catch (e) { studentPhotos = {}; }
            }
        }

        window.addSettingsPhoto = function() {
            const container = document.getElementById('settingsPhotoContainer');
            const id = photoIdCounter++;
            
            const div = document.createElement('div');
            div.className = 'photo-upload-item';
            div.id = `photoItem_${id}`;
            div.innerHTML = `
                <div class="photo-preview" id="photoPreview_${id}"><span class="placeholder">Click<br/>to add</span></div>
                <div class="photo-info">
                    <input type="text" id="photoStudentName_${id}" placeholder="Enter Student Name" />
                    <small>Enter the student's FULL NAME</small>
                    <div class="photo-guidelines">📸 Max: 2MB | JPG, PNG, GIF | 200x200px</div>
                </div>
                <input type="file" id="photoInput_${id}" accept="image/*" style="display:none;" />
                <button class="btn btn-danger btn-sm" onclick="removeSettingsPhoto(${id})">✕</button>
            `;
            
            const preview = div.querySelector('.photo-preview');
            const fileInput = div.querySelector('input[type="file"]');
            const studentNameInput = div.querySelector(`#photoStudentName_${id}`);
            
            preview.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        showStatus('❌ Photo size exceeds 2MB. Please reduce the file size.', 'error');
                        return;
                    }
                    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    if (!validTypes.includes(file.type)) {
                        showStatus('❌ Invalid file type. Please upload JPG, PNG, GIF, or WebP.', 'error');
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const dataUrl = event.target.result;
                        preview.innerHTML = `<img src="${dataUrl}" />`;
                        const autoName = file.name.replace(/\.[^/.]+$/, '').trim().replace(/[_-]/g, ' ');
                        if (autoName && !studentNameInput.value) {
                            studentNameInput.value = autoName;
                        }
                        saveSettingsPhoto(id);
                        showStatus(`Photo uploaded!`, 'success');
                    };
                    reader.readAsDataURL(file);
                }
            });
            studentNameInput.addEventListener('change', () => saveSettingsPhoto(id));
            container.appendChild(div);
        };

        function saveSettingsPhoto(id) {
            const studentNameInput = document.getElementById(`photoStudentName_${id}`);
            const preview = document.getElementById(`photoPreview_${id}`);
            const img = preview.querySelector('img');
            if (!img) return;
            const studentName = studentNameInput.value.trim();
            for (const key of Object.keys(studentPhotos)) {
                if (studentPhotos[key] === img.src && key !== studentName) {
                    delete studentPhotos[key];
                }
            }
            if (studentName) {
                studentPhotos[studentName] = img.src;
                localStorage.setItem('studentPhotosByName', JSON.stringify(studentPhotos));
            }
        }

        window.removeSettingsPhoto = function(id) {
            const item = document.getElementById(`photoItem_${id}`);
            if (item) {
                const input = document.getElementById(`photoStudentName_${id}`);
                if (input) {
                    const studentName = input.value.trim();
                    if (studentName) {
                        delete studentPhotos[studentName];
                        localStorage.setItem('studentPhotosByName', JSON.stringify(studentPhotos));
                    }
                }
                item.remove();
                showStatus('Photo removed', 'info');
            }
        };

        window.clearAllSettingsPhotos = function() {
            if (confirm('Remove all photos?')) {
                studentPhotos = {};
                localStorage.removeItem('studentPhotosByName');
                document.getElementById('settingsPhotoContainer').innerHTML = '';
                photoIdCounter = 0;
                showStatus('All photos cleared', 'info');
            }
        };

        function renderSettingsPhotos() {
            const container = document.getElementById('settingsPhotoContainer');
            container.innerHTML = '';
            photoIdCounter = 0;
            const names = Object.keys(studentPhotos);
            if (names.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.style.cssText = 'color: #999; text-align: center; padding: 10px;';
                emptyMsg.textContent = 'No photos uploaded. Photos are optional.';
                container.appendChild(emptyMsg);
                return;
            }
            names.forEach(studentName => {
                const id = photoIdCounter++;
                const dataUrl = studentPhotos[studentName];
                const div = document.createElement('div');
                div.className = 'photo-upload-item';
                div.id = `photoItem_${id}`;
                div.innerHTML = `
                    <div class="photo-preview" id="photoPreview_${id}"><img src="${dataUrl}" /></div>
                    <div class="photo-info">
                        <input type="text" id="photoStudentName_${id}" value="${studentName}" placeholder="Enter Student Name" />
                        <small>Enter the student's FULL NAME</small>
                        <div class="photo-guidelines">📸 Max: 2MB | JPG, PNG, GIF | 200x200px</div>
                    </div>
                    <input type="file" id="photoInput_${id}" accept="image/*" style="display:none;" />
                    <button class="btn btn-danger btn-sm" onclick="removeSettingsPhoto(${id})">✕</button>
                `;
                const preview = div.querySelector('.photo-preview');
                const fileInput = div.querySelector('input[type="file"]');
                const studentNameInput = div.querySelector(`#photoStudentName_${id}`);
                preview.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                            showStatus('❌ Photo size exceeds 2MB.', 'error');
                            return;
                        }
                        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                        if (!validTypes.includes(file.type)) {
                            showStatus('❌ Invalid file type.', 'error');
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = function(event) {
                            const dataUrl = event.target.result;
                            preview.innerHTML = `<img src="${dataUrl}" />`;
                            const autoName = file.name.replace(/\.[^/.]+$/, '').trim().replace(/[_-]/g, ' ');
                            if (autoName && !studentNameInput.value) {
                                studentNameInput.value = autoName;
                            }
                            saveSettingsPhoto(id);
                            showStatus(`Photo updated!`, 'success');
                        };
                        reader.readAsDataURL(file);
                    }
                });
                studentNameInput.addEventListener('change', function() {
                    const oldName = studentName;
                    const newName = this.value.trim();
                    if (oldName !== newName) {
                        delete studentPhotos[oldName];
                        if (newName) {
                            studentPhotos[newName] = dataUrl;
                            localStorage.setItem('studentPhotosByName', JSON.stringify(studentPhotos));
                        }
                        renderSettingsPhotos();
                        return;
                    }
                    saveSettingsPhoto(id);
                });
                container.appendChild(div);
            });
        }

        // ============================================================
        // SETTINGS - Badge
        // ============================================================
        document.getElementById('settingsBadgeUpload').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 2 * 1024 * 1024) {
                    showStatus('❌ Badge size exceeds 2MB.', 'error');
                    return;
                }
                const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!validTypes.includes(file.type)) {
                    showStatus('❌ Invalid file type.', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(event) {
                    const dataUrl = event.target.result;
                    document.getElementById('settingsBadgePreview').innerHTML = `<img src="${dataUrl}" />`;
                    localStorage.setItem('reportCardBadge', dataUrl);
                    updateDashboardBadge();
                    showStatus('✅ School badge uploaded!', 'success');
                };
                reader.readAsDataURL(file);
            }
        });

        window.clearSettingsBadge = function() {
            localStorage.removeItem('reportCardBadge');
            document.getElementById('settingsBadgePreview').innerHTML = `<span class="placeholder">Upload<br/>Badge</span>`;
            document.getElementById('settingsBadgeUpload').value = '';
            updateDashboardBadge();
            showStatus('Badge removed', 'info');
        };

        function loadSettingsBadge() {
            const badge = localStorage.getItem('reportCardBadge');
            if (badge) {
                document.getElementById('settingsBadgePreview').innerHTML = `<img src="${badge}" />`;
                updateDashboardBadge();
            }
        }

        function updateDashboardBadge() {
            const badge = localStorage.getItem('reportCardBadge');
            const img = document.getElementById('dashboardBadge');
            const placeholder = document.getElementById('dashboardBadgePlaceholder');
            if (badge) {
                img.src = badge;
                img.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                img.style.display = 'none';
                placeholder.style.display = 'block';
            }
        }

        // ============================================================
        // SAVE / LOAD SETTINGS
        // ============================================================
        window.saveAllSettings = function() {
            const schoolName = document.getElementById('settingsSchoolName').value.trim();
            const schoolMotto = document.getElementById('settingsSchoolMotto').value.trim();
            const schoolAddress = document.getElementById('settingsSchoolAddress').value.trim();
            const schoolPhone = document.getElementById('settingsSchoolPhone').value.trim();
            const term = document.getElementById('settingsTerm').value;
            const year = document.getElementById('settingsYear').value;
            const defaultClass = document.getElementById('settingsDefaultClass').value;
            
            CLASSES.forEach(cls => {
                const link = document.getElementById(CLASS_IDS[cls]).value.trim();
                localStorage.setItem('classLink_' + cls, link);
            });

            localStorage.setItem('reportCardSchoolName', schoolName);
            localStorage.setItem('reportCardSchoolMotto', schoolMotto);
            localStorage.setItem('reportCardSchoolAddress', schoolAddress);
            localStorage.setItem('reportCardSchoolPhone', schoolPhone);
            localStorage.setItem('settingsTerm', term);
            localStorage.setItem('settingsYear', year);
            localStorage.setItem('settingsDefaultClass', defaultClass);
            
            document.getElementById('dashboardSchoolName').textContent = schoolName;
            document.getElementById('dashboardMotto').textContent = schoolMotto;
            document.getElementById('headerMotto').textContent = schoolMotto;
            document.getElementById('dashboardClassDisplay').textContent = `Class: ${defaultClass} | Term: ${term} | Year: ${year}`;
            
            loadClassSelectors();
            showStatus('✅ All settings saved successfully!', 'success');
        };

        window.loadSettings = function() {
            const schoolName = localStorage.getItem('reportCardSchoolName');
            const schoolMotto = localStorage.getItem('reportCardSchoolMotto');
            const schoolAddress = localStorage.getItem('reportCardSchoolAddress');
            const schoolPhone = localStorage.getItem('reportCardSchoolPhone');
            const term = localStorage.getItem('settingsTerm');
            const year = localStorage.getItem('settingsYear');
            const defaultClass = localStorage.getItem('settingsDefaultClass');
            
            CLASSES.forEach(cls => {
                const link = localStorage.getItem('classLink_' + cls);
                if (link) document.getElementById(CLASS_IDS[cls]).value = link;
            });

            if (schoolName) document.getElementById('settingsSchoolName').value = schoolName;
            if (schoolMotto) document.getElementById('settingsSchoolMotto').value = schoolMotto;
            if (schoolAddress) document.getElementById('settingsSchoolAddress').value = schoolAddress;
            if (schoolPhone) document.getElementById('settingsSchoolPhone').value = schoolPhone;
            if (term) document.getElementById('settingsTerm').value = term;
            if (year) document.getElementById('settingsYear').value = year;
            if (defaultClass) document.getElementById('settingsDefaultClass').value = defaultClass;
            
            document.getElementById('dashboardSchoolName').textContent = schoolName || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            document.getElementById('dashboardMotto').textContent = schoolMotto || '"A PEN PAYS"';
            document.getElementById('headerMotto').textContent = schoolMotto || '"Empowering Ugandan Education, One Student at a Time" 🇺🇬';
            document.getElementById('dashboardClassDisplay').textContent = `Class: ${defaultClass || 'S.2'} | Term: ${term || 'III'} | Year: ${year || '2025'}`;
            
            loadSettingsBadge();
            loadSettingsPhotos();
            loadRegisterSettings();
            loadScoresSettings();
            loadClassSelectors();
            renderTeacherAccountsTable();
            
            updateDashboard();
            showStatus('✅ Settings loaded successfully!', 'success');
        };

        // ============================================================
        // DASHBOARD UPDATE
        // ============================================================
        function updateDashboard() {
            const schoolName = localStorage.getItem('reportCardSchoolName') || 'SMB BRAIN CENTRE SECONDARY SCHOOL';
            const schoolMotto = localStorage.getItem('reportCardSchoolMotto') || '"A PEN PAYS"';
            const defaultClass = localStorage.getItem('settingsDefaultClass') || 'S.2';
            const term = localStorage.getItem('settingsTerm') || 'III';
            const year = localStorage.getItem('settingsYear') || '2025';
            
            document.getElementById('dashboardSchoolName').textContent = schoolName;
            document.getElementById('dashboardMotto').textContent = schoolMotto;
            document.getElementById('headerMotto').textContent = schoolMotto;
            document.getElementById('dashboardClassDisplay').textContent = `Class: ${defaultClass} | Term: ${term} | Year: ${year}`;
            updateDashboardBadge();
            
            let studentsWithScores = new Set();
            let subjectScoreMap = {};
            
            if (allReportData.length > 0) {
                allReportData.forEach(student => {
                    student.subjects.forEach(subj => {
                        if (subj.aoi !== '-') {
                            studentsWithScores.add(student.id);
                            if (!subjectScoreMap[subj.name]) {
                                subjectScoreMap[subj.name] = { count: 0, students: new Set() };
                            }
                            subjectScoreMap[subj.name].count++;
                            subjectScoreMap[subj.name].students.add(student.id);
                        }
                    });
                });
            }
            
            document.getElementById('dashClassStudents').textContent = studentsWithScores.size || '0';
            document.getElementById('dashSchoolStudents').textContent = studentsWithScores.size || '0';
            
            const subjectNames = Object.keys(subjectScoreMap);
            document.getElementById('dashSubjects').textContent = subjectNames.length || '0';
            
            const subjectListDiv = document.getElementById('subjectScoreList');
            if (subjectNames.length > 0) {
                subjectListDiv.innerHTML = subjectNames.map(name => {
                    const count = subjectScoreMap[name].students.size;
                    return `<span class="subject-tag">${name} <span class="score-count">${count}</span></span>`;
                }).join('');
            } else {
                subjectListDiv.innerHTML = '<span style="color: #999; font-size: 14px;">No subjects with scores yet. Post scores to see them here.</span>';
            }
            
            let miniReady = 0;
            if (miniReportData.length > 0) {
                miniReady = miniReportData.filter(s => s.subjectCount > 0).length;
            } else if (allReportData.length > 0) {
                miniReady = allReportData.filter(s => s.subjectCount > 0).length;
            }
            document.getElementById('dashMiniReady').textContent = miniReady || '0';
        }

        // ============================================================
        // HELPERS
        // ============================================================
        function showStatus(message, type = 'info') {
            const msg = document.getElementById('statusMessage');
            if (!message) { msg.style.display = 'none'; return; }
            msg.style.display = 'block';
            msg.className = 'status-message ' + type;
            msg.textContent = message;
        }

        // ============================================================
        // TEACHER ACCOUNTS API
        // ============================================================
        async function callAccountsApi(payload) {
            const scriptUrl = getAuthScriptUrl();
            const sheetId = getAccountsSheetId();
            if (!sheetId) {
                showStatus('⚠️ Accounts sheet ID is not configured.', 'error');
                return null;
            }
            const formData = new URLSearchParams();
            formData.append('sheetId', sheetId);
            Object.entries(payload).forEach(([k, v]) => formData.append(k, v));
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });
            return response.json();
        }

        // ============================================================
        // GENERATE TEACHER ACCOUNT (with multiple assignments)
        // ============================================================
        async function generateTeacherAccount() {
            const name = document.getElementById('newTeacherName').value.trim();
            const initials = document.getElementById('newTeacherInitials').value.trim().toUpperCase();
            const assignments = getTeacherAssignments();

            if (!name) { showStatus("Please enter the teacher's full name.", 'error'); return; }
            if (!initials) { showStatus('Please enter teacher initials.', 'error'); return; }
            if (assignments.length === 0) { showStatus('Please add at least one class and subject assignment.', 'error'); return; }

            showStatus('Creating teacher account...', 'info');
            document.getElementById('loadingSpinner').classList.add('active');
            try {
                const result = await callAccountsApi({
                    action: 'createTeacherAccount',
                    name: name,
                    initials: initials,
                    assignments: JSON.stringify(assignments)
                });
                document.getElementById('loadingSpinner').classList.remove('active');
                if (!result) return;
                if (result.success) {
                    const { username, password } = result.data;
                    let assignmentsHTML = assignments.map(a => 
                        `<span style="display:inline-block;background:#e8f0fe;padding:2px 10px;border-radius:12px;margin:2px;font-size:12px;">${a.class} - ${a.subject}</span>`
                    ).join(' ');
                    
                    document.getElementById('newTeacherCredsBox').innerHTML = `
                        <div class="teacher-credentials-card">
                            <div style="font-weight:700;color:#0f3460;margin-bottom:8px;">✅ Credentials generated for ${name}</div>
                            <div class="cred-row"><span>Username:</span><span class="cred-value">${username}</span></div>
                            <div class="cred-row"><span>Password:</span><span class="cred-value">${password}</span></div>
                            <div style="margin-top:8px;font-size:13px;color:#555;">
                                <strong>Assigned Classes & Subjects:</strong><br/>
                                ${assignmentsHTML}
                            </div>
                            <div style="font-size:12px;color:#888;margin-top:8px;">⚠️ Copy and share these with the teacher now. They log in from the app's landing screen ("Teacher" login).</div>
                        </div>
                    `;
                    document.getElementById('newTeacherName').value = '';
                    document.getElementById('newTeacherInitials').value = '';
                    // Reset assignments to one empty row
                    document.getElementById('teacherAssignmentsContainer').innerHTML = `
                        <div class="teacher-assignment-item">
                            <select class="teacher-assignment-class">
                                <option value="">Select Class</option>
                                <option value="S.1">S.1</option>
                                <option value="S.2">S.2</option>
                                <option value="S.3">S.3</option>
                                <option value="S.4">S.4</option>
                                <option value="S.5">S.5</option>
                                <option value="S.6">S.6</option>
                            </select>
                            <select class="teacher-assignment-subject">
                                <option value="">Select Subject</option>
                                <option value="English">English</option>
                                <option value="Mathematics">Mathematics</option>
                                <option value="Physics">Physics</option>
                                <option value="Chemistry">Chemistry</option>
                                <option value="Biology">Biology</option>
                                <option value="Geography">Geography</option>
                                <option value="History">History</option>
                                <option value="CRE">CRE</option>
                                <option value="Computer Studies">Computer Studies</option>
                                <option value="Luganda">Luganda</option>
                                <option value="Kiswahili">Kiswahili</option>
                                <option value="Agriculture">Agriculture</option>
                                <option value="Entrepreneurship">Entrepreneurship</option>
                            </select>
                            <button type="button" class="btn btn-danger btn-sm" onclick="removeAssignment(this)">✕</button>
                        </div>
                    `;
                    assignmentCounter = 1;
                    renderTeacherAccountsTable();
                    showStatus('✅ Teacher account created.', 'success');
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                document.getElementById('loadingSpinner').classList.remove('active');
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        async function deleteTeacherAccount(username) {
            if (!confirm('Delete this teacher account? They will no longer be able to log in.')) return;
            showStatus('Removing account...', 'info');
            try {
                const result = await callAccountsApi({ action: 'deleteAccount', username: username });
                if (result && result.success) {
                    renderTeacherAccountsTable();
                    showStatus('Teacher account deleted.', 'info');
                } else {
                    showStatus('❌ ' + (result ? result.message : 'Could not delete account.'), 'error');
                }
            } catch (error) {
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        async function renderTeacherAccountsTable() {
            const container = document.getElementById('teacherAccountsList');
            if (!container) return;
            if (!getAccountsSheetId()) {
                container.innerHTML = '<p style="color:#999;font-size:13px;">Accounts sheet ID is not configured.</p>';
                return;
            }
            container.innerHTML = '<p style="color:#999;font-size:13px;">Loading...</p>';
            try {
                const result = await callAccountsApi({ action: 'getAccounts', role: 'Teacher' });
                if (!result || !result.success) {
                    container.innerHTML = `<p style="color:#e53e3e;font-size:13px;">❌ ${result ? result.message : 'Could not load accounts.'}</p>`;
                    return;
                }
                const accounts = result.data?.accounts || [];
                if (accounts.length === 0) {
                    container.innerHTML = '<p style="color:#999;font-size:13px;">No teacher accounts yet.</p>';
                    return;
                }
                container.innerHTML = accounts.map(a => {
                    let assignmentsDisplay = '';
                    if (a.assignments) {
                        try {
                            const assignments = JSON.parse(a.assignments);
                            assignmentsDisplay = assignments.map(ass => 
                                `<span style="display:inline-block;background:#e8f0fe;padding:1px 8px;border-radius:10px;margin:1px;font-size:11px;">${ass.class} - ${ass.subject}</span>`
                            ).join(' ');
                        } catch(e) {
                            assignmentsDisplay = `<span style="font-size:11px;color:#888;">${a.class} - ${a.subject}</span>`;
                        }
                    } else {
                        assignmentsDisplay = `<span style="font-size:11px;color:#888;">${a.class} - ${a.subject}</span>`;
                    }
                    
                    return `
                    <div class="teacher-account-row">
                        <div class="ta-info">
                            <strong>${a.name}</strong> (${a.initials})<br/>
                            Assignments: ${assignmentsDisplay}<br/>
                            Username: <span class="cred-value" style="font-size:12px;">${a.username}</span>
                            Password: <span class="cred-value" style="font-size:12px;">${a.password}</span>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="deleteTeacherAccount('${a.username}')">🗑️ Remove</button>
                    </div>
                `}).join('');
            } catch (error) {
                container.innerHTML = `<p style="color:#e53e3e;font-size:13px;">❌ ${error.message}</p>`;
            }
        }

        // ============================================================
        // LOGIN GATE
        // ============================================================
        function setAuthRole(role) {
            pendingAuthRole = role;
            document.getElementById('roleBtnAdmin').classList.toggle('active', role === 'admin');
            document.getElementById('roleBtnTeacher').classList.toggle('active', role === 'teacher');
            document.getElementById('authModeToggle').style.display = (role === 'admin') ? 'block' : 'none';
            document.getElementById('authTeacherHint').style.display = (role === 'teacher') ? 'block' : 'none';
            document.getElementById('authUsername').value = '';
            document.getElementById('authPassword').value = '';
            setAuthMode(role === 'teacher' ? 'login' : pendingAuthMode);
        }

        function setAuthMode(mode) {
            pendingAuthMode = mode;
            document.getElementById('modeBtnLogin').classList.toggle('active', mode === 'login');
            document.getElementById('modeBtnSignup').classList.toggle('active', mode === 'signup');
            document.getElementById('loginFields').style.display = (mode === 'login') ? 'block' : 'none';
            document.getElementById('signupFields').style.display = (mode === 'signup') ? 'block' : 'none';
            document.getElementById('authSubtitle').textContent = (mode === 'signup') ? 'Create the first/another admin account' : 'Please sign in to continue';
            document.getElementById('authStatus').style.display = 'none';
        }

        function showAuthStatus(message, type) {
            const el = document.getElementById('authStatus');
            el.style.display = 'block';
            el.className = 'status-message ' + type;
            el.textContent = message;
        }

        async function attemptAdminSignup() {
            const name = document.getElementById('signupName').value.trim();
            const username = document.getElementById('signupUsername').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirm = document.getElementById('signupPasswordConfirm').value;

            if (!name) { showAuthStatus('Please enter your full name.', 'error'); return; }
            if (!username) { showAuthStatus('Please choose a username.', 'error'); return; }
            if (password.length < 6) { showAuthStatus('Password should be at least 6 characters.', 'error'); return; }
            if (password !== confirm) { showAuthStatus('Passwords do not match.', 'error'); return; }

            const sheetId = getAccountsSheetId();
            const scriptUrl = getAuthScriptUrl();
            if (!sheetId) {
                showAuthStatus('⚠️ Accounts sheet ID is not configured.', 'error');
                return;
            }

            const btn = document.getElementById('authSignupBtn');
            btn.disabled = true; btn.textContent = '⏳ Creating account...';
            showAuthStatus('Creating your admin account...', 'info');

            try {
                const formData = new URLSearchParams();
                formData.append('action', 'signupAdmin');
                formData.append('sheetId', sheetId);
                formData.append('name', name);
                formData.append('username', username);
                formData.append('password', password);

                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                btn.disabled = false; btn.textContent = '✅ Create Admin Account';

                if (result.success) {
                    authSession = result.data;
                    sessionStorage.setItem('authSession', JSON.stringify(authSession));
                    enterApp(authSession);
                } else {
                    showAuthStatus('❌ ' + (result.message || 'Could not create account.'), 'error');
                }
            } catch (error) {
                btn.disabled = false; btn.textContent = '✅ Create Admin Account';
                showAuthStatus('❌ Error: ' + error.message, 'error');
            }
        }

        async function attemptLogin() {
            const username = document.getElementById('authUsername').value.trim();
            const password = document.getElementById('authPassword').value;
            if (!username || !password) { showAuthStatus('Please enter username and password.', 'error'); return; }

            const sheetId = getAccountsSheetId();
            const scriptUrl = getAuthScriptUrl();
            if (!sheetId) {
                showAuthStatus('⚠️ Accounts sheet ID is not configured.', 'error');
                return;
            }

            const btn = document.getElementById('authLoginBtn');
            btn.disabled = true; btn.textContent = '⏳ Signing in...';
            showAuthStatus('Checking credentials...', 'info');

            try {
                const formData = new URLSearchParams();
                formData.append('action', 'verifyLogin');
                formData.append('sheetId', sheetId);
                formData.append('role', pendingAuthRole);
                formData.append('username', username);
                formData.append('password', password);

                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                btn.disabled = false; btn.textContent = '🔓 Login';

                if (result.success) {
                    authSession = result.data;
                    sessionStorage.setItem('authSession', JSON.stringify(authSession));
                    enterApp(authSession);
                } else {
                    showAuthStatus('❌ ' + (result.message || 'Invalid username or password.'), 'error');
                }
            } catch (error) {
                btn.disabled = false; btn.textContent = '🔓 Login';
                showAuthStatus('❌ Error: ' + error.message, 'error');
            }
        }

        function enterApp(session) {
            document.getElementById('authGate').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';

            if (session.role === 'admin') {
                document.getElementById('userBadgeText').textContent = `👨‍💼 Admin: ${session.name || session.username}`;
                document.getElementById('mainTabBar').style.display = 'flex';
                document.getElementById('teacherStandaloneView').style.display = 'none';
                document.querySelectorAll('.form-section').forEach(el => el.style.display = '');
                switchTab('dashboard');
                setTimeout(() => {
                    if (document.getElementById('scoreClassSelect').value) loadStudents();
                    if (document.getElementById('reportClassSelect').value) fetchReportData();
                }, 300);
            } else {
                document.getElementById('userBadgeText').textContent = `👩‍🏫 Teacher: ${session.name || session.username}`;
                document.getElementById('mainTabBar').style.display = 'none';
                document.querySelectorAll('.form-section').forEach(el => el.style.display = 'none');
                document.getElementById('teacherStandaloneView').style.display = 'block';
                document.getElementById('tpTeacherName').textContent = session.name;
                // For teachers with multiple assignments, show the first one
                if (session.assignments) {
                    try {
                        const assignments = JSON.parse(session.assignments);
                        if (assignments && assignments.length > 0) {
                            document.getElementById('tpTeacherClass').textContent = assignments.map(a => a.class).join(', ');
                            document.getElementById('tpTeacherSubject').textContent = assignments.map(a => a.subject).join(', ');
                            document.getElementById('tpSubjectHeading').textContent = assignments.map(a => `${a.class} - ${a.subject}`).join(' | ');
                        }
                    } catch(e) {
                        document.getElementById('tpTeacherClass').textContent = session.class || '-';
                        document.getElementById('tpTeacherSubject').textContent = session.subject || '-';
                        document.getElementById('tpSubjectHeading').textContent = session.subject || '-';
                    }
                } else {
                    document.getElementById('tpTeacherClass').textContent = session.class || '-';
                    document.getElementById('tpTeacherSubject').textContent = session.subject || '-';
                    document.getElementById('tpSubjectHeading').textContent = session.subject || '-';
                }
                tpLoadStudents();
            }
        }

        function appLogout() {
            sessionStorage.removeItem('authSession');
            location.reload();
        }

        function restoreSession() {
            const saved = sessionStorage.getItem('authSession');
            if (!saved) return;
            try {
                authSession = JSON.parse(saved);
                enterApp(authSession);
            } catch (e) { authSession = null; }
        }

        // ============================================================
        // TEACHER SCORE POSTING
        // ============================================================
        async function tpLoadStudents() {
            if (!authSession || authSession.role !== 'teacher') return;
            
            // Get the first class from assignments
            let teacherClass = '';
            if (authSession.assignments) {
                try {
                    const assignments = JSON.parse(authSession.assignments);
                    if (assignments && assignments.length > 0) {
                        teacherClass = assignments[0].class;
                    }
                } catch(e) {
                    teacherClass = authSession.class || '';
                }
            } else {
                teacherClass = authSession.class || '';
            }
            
            const sheetId = getClassSheetId(teacherClass);
            const scriptUrl = getDataScriptUrl();
            if (!sheetId) { showStatus('⚠️ Class link not configured by admin yet.', 'error'); return; }

            showStatus('Loading students...', 'info');
            document.getElementById('loadingSpinner').classList.add('active');
            try {
                const formData = new URLSearchParams();
                formData.append('action', 'getStudents');
                formData.append('sheetId', sheetId);
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                document.getElementById('loadingSpinner').classList.remove('active');
                if (result.success) {
                    const students = result.data?.students || [];
                    tpScoreRows = students.map(s => ({ studentId: s.studentId, studentName: s.studentName, aoi: '', eot: '' }));
                    tpScoreRowsBackup = [...tpScoreRows];
                    tpRenderTable();
                    showStatus(`✅ Loaded ${students.length} students from ${teacherClass}`, 'success');
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                document.getElementById('loadingSpinner').classList.remove('active');
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        function tpFilterRows() {
            const term = document.getElementById('tpSearchInput').value.toLowerCase().trim();
            if (!term) {
                tpScoreRows = [...tpScoreRowsBackup];
                tpRenderTable();
                document.getElementById('tpSearchCount').textContent = 'Showing all students';
                return;
            }
            tpScoreRows = tpScoreRowsBackup.filter(r => r.studentId.toLowerCase().includes(term) || r.studentName.toLowerCase().includes(term));
            tpRenderTable();
            document.getElementById('tpSearchCount').textContent = `Showing ${tpScoreRows.length} of ${tpScoreRowsBackup.length} students`;
        }

        function tpUpdateRow(index, field, value) {
            tpScoreRows[index][field] = value;
            const actualIndex = tpScoreRowsBackup.indexOf(tpScoreRows[index]);
            if (actualIndex !== -1) tpScoreRowsBackup[actualIndex][field] = value;
        }

        function tpRenderTable() {
            const tbody = document.getElementById('tpScoreTableBody');
            if (tpScoreRows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;padding:30px;">📋 No students found. Click Refresh.</td></tr>`;
                return;
            }
            tbody.innerHTML = tpScoreRows.map((row, index) => `
                <tr>
                    <td class="student-id-col">${row.studentId}</td>
                    <td class="student-name-col">${row.studentName}</td>
                    <td><input type="number" class="score-input-aoi" value="${row.aoi}" placeholder="0-20" min="0" max="20" onchange="tpUpdateRow(${index}, 'aoi', this.value)" onkeyup="tpUpdateRow(${index}, 'aoi', this.value)" /></td>
                    <td><input type="number" class="score-input-eot" value="${row.eot}" placeholder="0-80" min="0" max="80" onchange="tpUpdateRow(${index}, 'eot', this.value)" onkeyup="tpUpdateRow(${index}, 'eot', this.value)" /></td>
                </tr>
            `).join('');
        }

        async function tpPostScores() {
            if (!authSession || authSession.role !== 'teacher') return;
            
            // Get the first class and subject from assignments
            let teacherClass = '', teacherSubject = '', teacherInitials = authSession.initials || '';
            if (authSession.assignments) {
                try {
                    const assignments = JSON.parse(authSession.assignments);
                    if (assignments && assignments.length > 0) {
                        teacherClass = assignments[0].class;
                        teacherSubject = assignments[0].subject;
                    }
                } catch(e) {
                    teacherClass = authSession.class || '';
                    teacherSubject = authSession.subject || '';
                }
            } else {
                teacherClass = authSession.class || '';
                teacherSubject = authSession.subject || '';
            }
            
            const sheetId = getClassSheetId(teacherClass);
            const scriptUrl = getDataScriptUrl();
            if (!sheetId) { showStatus('⚠️ Class link not configured by admin yet.', 'error'); return; }

            let hasError = false;
            for (const row of tpScoreRows) {
                const aoi = parseFloat(row.aoi), eot = parseFloat(row.eot);
                if (row.aoi !== '' && aoi > 20) { showStatus(`AOI cannot exceed 20 for ${row.studentId}`, 'error'); hasError = true; }
                if (row.eot !== '' && eot > 80) { showStatus(`EOT cannot exceed 80 for ${row.studentId}`, 'error'); hasError = true; }
            }
            if (hasError) return;

            const valid = tpScoreRows.filter(r => r.studentId && r.studentId.trim() && (r.aoi !== '' || r.eot !== ''));
            if (valid.length === 0) { showStatus('Please enter scores for at least one student.', 'error'); return; }

            const scores = valid.map(r => ({
                studentId: r.studentId.trim(),
                studentName: r.studentName.trim(),
                aoi: r.aoi !== '' ? parseFloat(r.aoi) : null,
                eot: r.eot !== '' ? parseFloat(r.eot) : null,
                teacherInitials: teacherInitials
            }));

            const formData = new URLSearchParams();
            formData.append('action', 'postScores');
            formData.append('sheetId', sheetId);
            formData.append('subject', teacherSubject);
            formData.append('scores', JSON.stringify(scores));
            formData.append('timestamp', new Date().toISOString());

            const btn = document.getElementById('tpSubmitBtn');
            btn.disabled = true; btn.textContent = '⏳ Posting...';
            showStatus('Posting scores...', 'info');
            document.getElementById('loadingSpinner').classList.add('active');

            try {
                const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                const result = await response.json();
                document.getElementById('loadingSpinner').classList.remove('active');
                btn.disabled = false; btn.textContent = '📤 Post Scores';
                if (result.success) {
                    const data = result.data || {};
                    showStatus(`✅ Scores posted for ${teacherSubject} (${data.added || 0} new, ${data.updated || 0} updated)`, 'success');
                    tpScoreRows = tpScoreRows.map(r => ({ ...r, aoi: '', eot: '' }));
                    tpScoreRowsBackup = [...tpScoreRows];
                    tpRenderTable();
                    updateDashboard();
                } else {
                    showStatus('❌ ' + result.message, 'error');
                }
            } catch (error) {
                document.getElementById('loadingSpinner').classList.remove('active');
                btn.disabled = false; btn.textContent = '📤 Post Scores';
                showStatus('❌ Error: ' + error.message, 'error');
            }
        }

        // ============================================================
        // INITIALIZATION
        // ============================================================
        window.addEventListener('DOMContentLoaded', function() {
            loadSettings();
            loadClassSelectors();
            loadSettingsBadge();
            loadSettingsPhotos();
            loadRegisterSettings();
            loadScoresSettings();

            document.getElementById('settingsTerm').addEventListener('change', saveAllSettings);
            document.getElementById('settingsYear').addEventListener('change', saveAllSettings);
            document.getElementById('settingsDefaultClass').addEventListener('change', saveAllSettings);

            CLASSES.forEach(cls => {
                document.getElementById(CLASS_IDS[cls]).addEventListener('change', function() {
                    saveAllSettings();
                    loadClassSelectors();
                });
            });

            updateDashboard();

            setAuthRole('admin');
            setAuthMode('login');
            restoreSession();
        });