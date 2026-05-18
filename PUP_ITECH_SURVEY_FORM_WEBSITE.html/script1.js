/*
    PUP ITech Feedback System Script
    - Handles section navigation and display state.
    - Validates consent and submits form data to Firestore.
    - Loads survey responses for the Results page.
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBgTr-cByidGG54_rjJGoMGZHL6_aAWEdO",
    authDomain: "itech-survey-form-database.firebaseapp.com",
    projectId: "itech-survey-form-database",
    storageBucket: "itech-survey-form-database.firebasestorage.app",
    messagingSenderId: "386902674261",
    appId: "1:386902674261:web:fad872eaf0eac211a1bddc",
    measurementId: "G-2P22516MTX"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ================================
// VALIDATION HELPERS
// ================================

// Only letters, spaces, hyphens, apostrophes (no digits)
function isTextOnly(value) {
    return /^[A-Za-zÀ-ÿ\s'\-]+$/.test(value.trim());
}

// Standard email format check
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Show inline error under a field
function showError(inputEl, message) {
    clearError(inputEl);
    inputEl.style.borderColor = "#e74c3c";
    const err = document.createElement('span');
    err.className = 'validation-error';
    err.style.cssText = "color:#e74c3c; font-size:0.85rem; font-family:'Times New Roman',serif; margin-top:2px; display:block;";
    err.textContent = message;
    inputEl.insertAdjacentElement('afterend', err);
}

// Remove inline error from a field
function clearError(inputEl) {
    inputEl.style.borderColor = "";
    const next = inputEl.nextElementSibling;
    if (next && next.classList.contains('validation-error')) next.remove();
}

// Attach live validation listeners to text/email inputs
function attachLiveValidation() {
    // Name field — letters only
    const nameInput = document.getElementById('name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            const anon = document.getElementById('anon').checked;
            if (anon) { clearError(nameInput); return; }
            if (nameInput.value === '') { clearError(nameInput); return; }
            if (/\d/.test(nameInput.value)) {
                showError(nameInput, 'Name must not contain numbers.');
            } else {
                clearError(nameInput);
            }
        });
    }

    // Email field — valid email format
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            const anon = document.getElementById('anon').checked;
            if (anon) { clearError(emailInput); return; }
            if (emailInput.value === '') { clearError(emailInput); return; }
            if (!isValidEmail(emailInput.value)) {
                showError(emailInput, 'Please enter a valid email address (e.g. name@email.com).');
            } else {
                clearError(emailInput);
            }
        });
        emailInput.addEventListener('input', () => {
            if (isValidEmail(emailInput.value)) clearError(emailInput);
        });
    }

    // "Other (please specify)" text fields — no pure-number entries
    document.querySelectorAll('input[name="issues_other"], input[name="q2r1_other"], input[name="preference_other"], input[name="improvement_other"], input[name="challenges_other"]')
        .forEach(input => {
            input.addEventListener('input', () => {
                if (input.value === '') { clearError(input); return; }
                if (/^\d+$/.test(input.value.trim())) {
                    showError(input, 'Please describe using words, not only numbers.');
                } else {
                    clearError(input);
                }
            });
        });

    // Suggestion textarea — no pure-number entries
    const suggestion = document.getElementById('q12c1');
    if (suggestion) {
        suggestion.addEventListener('input', () => {
            if (suggestion.value === '') { clearError(suggestion); return; }
            if (/^\d+$/.test(suggestion.value.trim())) {
                showError(suggestion, 'Please write your suggestion using words, not only numbers.');
            } else {
                clearError(suggestion);
            }
        });
    }
}

// Full validation run before submission; returns true if all pass
function validateForm() {
    let valid = true;
    const errors = [];

    const anon = document.getElementById('anon').checked;
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');

    // Name — required if not anonymous, no digits
    if (!anon) {
        if (!nameInput.value.trim()) {
            showError(nameInput, 'Name is required.');
            errors.push('Name is required.');
            valid = false;
        } else if (/\d/.test(nameInput.value)) {
            showError(nameInput, 'Name must not contain numbers.');
            errors.push('Name must not contain numbers.');
            valid = false;
        } else {
            clearError(nameInput);
        }

        // Email — required if not anonymous
        if (!emailInput.value.trim()) {
            showError(emailInput, 'Email is required.');
            errors.push('Email is required.');
            valid = false;
        } else if (!isValidEmail(emailInput.value)) {
            showError(emailInput, 'Please enter a valid email address (e.g. name@email.com).');
            errors.push('Invalid email format.');
            valid = false;
        } else {
            clearError(emailInput);
        }
    } else {
        clearError(nameInput);
        clearError(emailInput);
    }

    // Year level — must be selected
    const yearLevel = document.getElementById('yearlevel');
    if (!yearLevel.value) {
        yearLevel.style.borderColor = "#e74c3c";
        errors.push('Please select your Year Level.');
        valid = false;
    } else {
        yearLevel.style.borderColor = "";
    }

    // "Other specify" text fields — no pure-number values
    const otherFields = [
        { el: document.querySelector('input[name="issues_other"]'),     label: 'Q1 – Other issues' },
        { el: document.querySelector('input[name="q2r1_other"]'),        label: 'Q2 – Other hangout spot' },
        { el: document.querySelector('input[name="preference_other"]'), label: 'Q2 – Other preference factor' },
        { el: document.querySelector('input[name="improvement_other"]'),label: 'Q3 – Other improvement' },
        { el: document.querySelector('input[name="challenges_other"]'), label: 'Q4 – Other challenge' },
    ];

    otherFields.forEach(({ el, label }) => {
        if (!el) return;
        if (el.value.trim() && /^\d+$/.test(el.value.trim())) {
            showError(el, 'Please describe using words, not only numbers.');
            errors.push(`${label}: text description required.`);
            valid = false;
        } else {
            clearError(el);
        }
    });

    // Suggestion textarea — no pure-number value
    const suggestion = document.getElementById('q12c1');
    if (suggestion && /^\d+$/.test(suggestion.value.trim())) {
        showError(suggestion, 'Please write your suggestion using words, not only numbers.');
        errors.push('Q12: Please write your suggestion using words.');
        valid = false;
    }

    if (!valid && errors.length) {
        // Scroll to the first errored element
        const firstError = document.querySelector('.validation-error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        alert("Please fix the following:\n• " + errors.join("\n• "));
    }

    return valid;
}


// Section visibility helper
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');


    const consent = document.getElementById('consentdiv');
    if (consent) consent.style.display = (sectionId === 'consentdiv') ? 'block' : 'none';


    const floatBtn = document.getElementById('surveybtn');
    if (floatBtn) floatBtn.style.display = (sectionId === 'surveydiv' || sectionId === 'consentdiv') ? 'none' : 'block';


    if (sectionId === 'resultdiv') loadResults();
}


// Setup page event listeners after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('homeBtn')?.addEventListener('click', () => showSection('homediv'));
    document.getElementById('resultsBtn')?.addEventListener('click', () => showSection('resultdiv'));
    document.getElementById('aboutBtn')?.addEventListener('click', () => showSection('aboutdiv'));
    document.getElementById('surveybtn')?.addEventListener('click', () => showSection('consentdiv'));

    // Attach live validation once the DOM is ready
    attachLiveValidation();

    // When anonymous is toggled, clear name/email errors immediately
    document.getElementById('anon')?.addEventListener('change', () => {
        const anon = document.getElementById('anon').checked;
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        nameInput.disabled = anon;
        emailInput.disabled = anon;
        if (anon) {
            clearError(nameInput);
            clearError(emailInput);
        }
    });

    document.getElementById('proceedbtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const consentCheckbox = document.getElementById('consentCheckbox');
        if (!consentCheckbox.checked) {
            alert("Please agree to the Privacy Consent first.");
            consentCheckbox.focus();
            return;
        }
        showSection('surveydiv');
    });

    // Submission handler moved inside DOMContentLoaded to guarantee the element exists
    document.getElementById('submitbtn')?.addEventListener('click', async (e) => {
    e.preventDefault();

    // Run full validation before doing anything
    if (!validateForm()) return;

    const issueCheckboxes = document.querySelectorAll('input[name="issues[]"]:checked');
    const selectedIssues = Array.from(issueCheckboxes).map(cb => cb.parentElement.textContent.trim());
    const issuesOther = document.querySelector('input[name="issues_other"]').value;


    const favoriteSpot = document.querySelector('input[name="q2r1"]:checked')?.parentElement.textContent.trim() || "None";


    const preferenceCheckboxes = document.querySelectorAll('input[name="preference[]"]:checked');
    const preferences = Array.from(preferenceCheckboxes).map(cb => cb.parentElement.textContent.trim());


    const getRadioValue = (name) =>
        document.querySelector(`input[name="${name}"]:checked`)?.parentElement.textContent.trim() || "No Rating";


    const feedbackData = {
        name: document.getElementById('anon').checked ? "Anonymous" : document.getElementById('name').value,
        email: document.getElementById('email').value,
        classroomIssues: selectedIssues,
        classroomIssuesOther: issuesOther,
        favoriteSpot: favoriteSpot,
        factorsForPreference: preferences,
        improvement: Array.from(document.querySelectorAll('input[name="improvement[]"]:checked')).map(cb => cb.parentElement.textContent.trim()),
        challenges: Array.from(document.querySelectorAll('input[name="challenges[]"]:checked')).map(cb => cb.parentElement.textContent.trim()),
        crMaintenance: getRadioValue('q5r3'),
        crFixtures: getRadioValue('q6r3'),
        crPrivacy: getRadioValue('q7r3'),
        crWaterSupply: getRadioValue('q8r3'),
        instructorAbility: getRadioValue('q9r'),
        curriculumFocus: getRadioValue('q10r'),
        workEthics: getRadioValue('q11r3'),
        suggestion: document.getElementById('q12c1').value,
        submittedAt: new Date()
    };


        try {
            await addDoc(collection(db, "responses"), feedbackData);
            alert("Full feedback submitted successfully!");
            showSection('resultdiv');
        } catch (error) {
            console.error("Submission Error: ", error);
        }
    });  // end submitbtn listener

}); // end DOMContentLoaded


// Load results from Firestore and render cards
async function loadResults() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;


    try {
        const querySnapshot = await getDocs(collection(db, "responses"));
        tableBody.innerHTML = "";


        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const getVal = (val) => (!val ? "No answer" : Array.isArray(val) ? val.join(", ") : val);


            const responseCard = `
                <div class="response-profile" style="background: rgba(255,255,255,0.1); border: 1px solid #fff; padding: 20px; margin-bottom: 20px; border-radius: 8px; color: white; text-align: left;">
                  <h3 style="color: #ffcc00; margin: 0;">Name: ${data.name || "Anonymous"}</h3>
                  <p style="margin: 5px 0 15px 0;"><strong>Email:</strong> ${data.email || "N/A"}</p>
                  <hr style="border: 0.5px solid rgba(255,255,255,0.3);">
                  <div style="font-size: 0.9em; line-height: 1.6;">
                    <p><strong>1. Environment:</strong> ${getVal(data.classroomIssues)}</p>
                    <p><strong>2. Hangout:</strong> ${getVal(data.favoriteSpot)}</p>
                    <p><strong>3. Lab Improvement:</strong> ${getVal(data.improvement)}</p>
                    <p><strong>4. Lab Challenges:</strong> ${getVal(data.challenges)}</p>
                    <p><strong>5. CR Cleanliness:</strong> ${getVal(data.crMaintenance)}</p>
                    <p><strong>6. CR Fixtures:</strong> ${getVal(data.crFixtures)}</p>
                    <p><strong>7. CR Privacy:</strong> ${getVal(data.crPrivacy)}</p>
                    <p><strong>8. Water/Tabo:</strong> ${getVal(data.crWaterSupply)}</p>
                    <p><strong>9. Instructor Ability:</strong> ${getVal(data.instructorAbility)}</p>
                    <p><strong>10. Curriculum Focus:</strong> ${getVal(data.curriculumFocus)}</p>
                    <p><strong>11. Work Ethics:</strong> ${getVal(data.workEthics)}</p>
                    <p><strong>12. Changes/Suggestions:</strong> ${getVal(data.suggestion)}</p>
                  </div>
                  <p style="font-size: 0.7em; opacity: 0.6; margin-top: 15px;">Submitted: ${data.submittedAt ? data.submittedAt.toDate().toLocaleString() : "N/A"}</p>
                </div>
            `;
            tableBody.innerHTML += `<tr><td>${responseCard}</td></tr>`;
        });
    } catch (error) {
        console.error("Error loading results:", error);
    }
}


window.showSection = showSection;

