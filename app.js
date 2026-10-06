const state={};
let q=0;
let screenHistory=[];
let currentScreen=null;
let restoring=false;
const area=document.getElementById("area"), bar=document.getElementById("bar"), step=document.getElementById("step"), pct=document.getElementById("pct");
const backBtn=document.getElementById("back");
const track=document.querySelector(".track");
let firstRender=true;
function focusArea(){if(firstRender){firstRender=false;return;}area.focus({preventScroll:true});area.scrollIntoView({block:"nearest",behavior:"smooth"});}

const blocked=new Set(["400","403dw","407","408","417","457","462","482","485","600","601","602","651","771","988","995"]);
const pacific=new Set(["Federated States of Micronesia","Fiji","Kiribati","Nauru","Palau","Papua New Guinea","Marshall Islands","Samoa","Solomon Islands","Timor-Leste","Tonga","Tuvalu","Vanuatu"]);
const asean=new Set(["Brunei Darussalam","Cambodia","Indonesia","Laos","Malaysia","Myanmar","Philippines","Singapore","Thailand","Vietnam"]);

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

function cloneState(){
  return JSON.parse(JSON.stringify(state));
}
function restoreState(snapshot){
  Object.keys(state).forEach(k=>delete state[k]);
  Object.assign(state, JSON.parse(JSON.stringify(snapshot || {})));
}
function beginScreen(renderer){
  if(!restoring && currentScreen) screenHistory.push(currentScreen);
  const thisQ=q+1;
  q=thisQ;
  currentScreen={renderer:renderer,snapshot:cloneState(),q:thisQ};
  backBtn.hidden=!screenHistory.length;
}
function goBack(){
  if(!screenHistory.length) return;
  const previous=screenHistory.pop();
  restoreState(previous.snapshot);
  q=previous.q-1;
  currentScreen=null;
  restoring=true;
  previous.renderer();
  restoring=false;
  backBtn.hidden=!screenHistory.length;
}
function prog(){const p=Math.min(95,10+(q-1)*13);bar.style.width=p+"%";step.textContent="Question "+q;pct.textContent=p+"%";track.setAttribute("aria-valuenow",p);}
function ask(title,help,opts,note=""){
  const renderer=()=>ask(title,help,opts,note);
  beginScreen(renderer);
  prog();
  area.innerHTML=`<div class="qno">Question ${q}</div><h2>${title}</h2><p class="help">${help||""}</p>${note?`<div class="note">${note}</div>`:""}<div class="options">${opts.map((o,i)=>`<button class="option" data-i="${i}" type="button"><strong>${o.label}</strong>${o.small?`<small>${o.small}</small>`:""}</button>`).join("")}</div>`;
  area.querySelectorAll(".option").forEach(b=>b.onclick=()=>opts[Number(b.dataset.i)].next());
  focusArea();
}
function askCountry(key,next){
  const renderer=()=>askCountry(key,next);
  beginScreen(renderer);
  prog();
  area.innerHTML=`<div class="qno">Question ${q}</div><h2>Passport country</h2><p class="help">Start typing and pick from the list.</p><label class="field-label" for="country">What passport does the PRIMARY student hold?</label><input id="country" class="input" list="countries" autocomplete="off" placeholder="e.g. Nepal" aria-describedby="countryError" value="${esc(state[key]||"")}"><div class="input-error" id="countryError" role="alert"></div><div class="actions"><button id="go" class="btn primary" type="button">Continue</button></div>`;
  const input=document.getElementById("country");
  const err=document.getElementById("countryError");
  const go=()=>{if(!input.value.trim()){err.textContent="Please enter a passport country.";input.classList.add("invalid");input.focus();return;}state[key]=input.value.trim();next();};
  focusArea();
  document.getElementById("go").onclick=go; input.onkeydown=e=>{if(e.key==="Enter")go();};
}

function start(){
  ask("What are you checking?","Choose the simplest option.",[
    {label:"Student applying alone",next:()=>{state.family=false;askLocation();}},
    {label:"Student applying with partner / child",next:()=>{state.family=true;askLocation();}}
  ]);
}

function askLocation(){
  ask("Where is the PRIMARY student now?","",[
    {label:"In Australia",next:()=>{state.primaryLocation="Australia";askCurrentVisa();}},
    {label:"Outside Australia",next:()=>{state.primaryLocation="Offshore";state.primaryResult="offshore";askFamilyOrFinish();}}
  ]);
}

function askCurrentVisa(){
  ask("What visa does the PRIMARY student hold now?","",[
    {label:"Subclass 500 — PRIMARY student",next:()=>{state.primaryVisa="500 primary";ask500Reason();}},
    {label:"Subclass 500 — DEPENDANT / secondary",small:"Now wants to become the main student",next:()=>{state.primaryVisa="500 secondary";state.primaryResult="offshore";state.primaryReason="A current 500 dependant who wants to become the primary student must apply offshore.";askFamilyOrFinish();}},
    {label:"482 / 485 / Visitor / Working Holiday / Training / Temporary Activity etc.",small:"Includes 400, 403 Domestic Worker, 407, 408, 417, 457, 462, 482, 485, 600, 601, 602, 651, 771, 988, certain 995",next:()=>{state.primaryVisa="prescribed visa";state.primaryResult="offshore";state.primaryReason="This visa is in the prescribed group that cannot lodge a Student visa onshore.";askFamilyOrFinish();}},
    {label:"Another substantive visa",small:"Not one of the visas listed above",next:()=>{state.primaryVisa="other substantive visa";state.primaryResult="onshore";state.primaryReason="The current visa is not in the prescribed onshore-prohibited list.";askFamilyOrFinish();}},
    {label:"Only Bridging visa / no substantive visa",next:()=>{state.primaryVisa="no substantive visa";askBridging();}}
  ]);
}

function askBridging(){
  ask("Why is the applicant on a Bridging visa?","Only special cases can lodge onshore.",[
    {label:"ART set aside a cancelled Student visa",small:"Within the special 28-day pathway",next:()=>{state.primaryResult="onshore";state.primaryReason="Special ART pathway appears to apply.";askFamilyOrFinish();}},
    {label:"Special Purpose / specified Diplomatic visa pathway",small:"Within the required 28-day period",next:()=>{state.primaryResult="onshore";state.primaryReason="Special no-substantive-visa pathway appears to apply.";askFamilyOrFinish();}},
    {label:"Anything else",next:()=>{state.primaryResult="offshore";state.primaryReason="An ordinary Bridging visa does not by itself allow onshore Student visa lodgement.";askFamilyOrFinish();}}
  ]);
}

function ask500Reason(){
  ask("Why does the student need another Student visa?","Choose the closest reason.",[
    {label:"Need more time to finish current study",next:()=>askSameProvider()},
    {label:"Finished current course and moving to a higher course",next:()=>askHigherCourse()},
    {label:"Doctoral degree / PhD",next:()=>{state.primaryResult="onshore";state.primaryReason="Doctoral student exception applies.";askFamilyOrFinish();}},
    {label:"Provider default",small:"Provider could not deliver the course",next:()=>{state.primaryResult="onshore";state.primaryReason="Provider-default exception may apply if the detailed requirements are met.";askFamilyOrFinish();}},
    {label:"School / Defence / Foreign Affairs student",next:()=>{state.primaryResult="onshore";state.primaryReason="A specified onshore exception applies.";askFamilyOrFinish();}},
    {label:"None of these",next:()=>{state.primaryResult="offshore";state.primaryReason="No onshore exception applies to the current 500 primary holder.";askFamilyOrFinish();}}
  ]);
}

function askSameProvider(){
  ask("Is the student still with the SAME education provider?","This is the key question for the simple extension pathway.",[
    {label:"YES — same provider",next:()=>askSameCourse()},
    {label:"NO — changed provider",next:()=>{state.primaryResult="offshore";state.primaryReason="Changed provider. The simple completion-of-study onshore exception does not apply.";askFamilyOrFinish();}}
  ]);
}

function askSameCourse(){
  ask("Is it the same principal course linked to the current visa?","A permitted alternative principal course with the same provider may also qualify.",[
    {label:"YES — same principal course",next:()=>askMonths()},
    {label:"Alternative principal course with SAME provider",small:"Only if not inconsistent with current visa conditions",next:()=>askMonths()},
    {label:"NO — different course and not a permitted alternative",next:()=>{state.primaryResult="offshore";state.primaryReason="The completion exception is not established.";askFamilyOrFinish();}}
  ]);
}

function askMonths(){
  ask("How long is left to finish the course?","",[
    {label:"Less than 12 months",next:()=>{state.primaryResult="onshore";state.primaryReason="Same provider + qualifying principal course + less than 12 months remaining.";askFamilyOrFinish();}},
    {label:"12 months or more",next:()=>{state.primaryResult="offshore";state.primaryReason="The course will not be completed within the required 12-month period.";askFamilyOrFinish();}}
  ]);
}

function askHigherCourse(){
  ask("Is the new course at a HIGHER AQF level?","Example: Bachelor → Master is higher. Master → another Master is not higher.",[
    {label:"YES — higher AQF level",next:()=>{state.primaryResult="onshore";state.primaryReason="The course-progression exception appears to apply, subject to the higher-education rules.";askFamilyOrFinish();}},
    {label:"NO — same or lower AQF level",next:()=>{state.primaryResult="offshore";state.primaryReason="The course-progression exception does not apply.";askFamilyOrFinish();}}
  ]);
}

function askFamilyOrFinish(){
  if(!state.family){showResult();return;}
  askCountry("primaryCountry",askFamilyPath);
}

function askFamilyPath(){
  const c=state.primaryCountry;
  if(pacific.has(c)||asean.has(c)){
    state.familyEligible=true;
    state.familyReason="Primary passport is within the specified family passport pathway.";
    askPartnerLocation();
    return;
  }
  ask("Can the partner / child use one of these family pathways?","Marriage alone is not enough under the new rules.",[
    {label:"Partner / child held a linked 500 SECONDARY before the new rules",small:"Transitional cases only — we will check the date",next:()=>askTransitionalSecondary()},
    {label:"Primary student is doing a doctoral degree / PhD",next:()=>{state.familyEligible=true;state.familyReason="Doctoral family pathway.";askPartnerLocation();}},
    {label:"Defence / Foreign Affairs / fully foreign-government-funded student",next:()=>{state.familyEligible=true;state.familyReason="Special family pathway.";askPartnerLocation();}},
    {label:"Special transitional/newborn case",next:()=>{state.familyEligible=true;state.familyReason="Transitional/newborn family pathway.";askPartnerLocation();}},
    {label:"None of these",next:()=>{state.familyEligible=false;state.familyReason="No permitted family pathway identified.";showResult();}}
  ]);
}

function askTransitionalSecondary(){
  ask(
    "Was the partner / child already linked to this SAME primary student before 2 October 2026?",
    "This is a transitional pathway. Simply holding a linked secondary Student visa now is not enough.",
    [
      {
        label:"YES — they held the linked 500 SECONDARY on 2 October 2026",
        small:"The primary applicant was the primary student for that visa",
        next:()=>{
          state.familyEligible=true;
          state.familyPathType="transitional_in_australia";
          state.familyReason="Transitional secondary pathway: the family applicant held the linked secondary Student visa on 2 October 2026 and must be in Australia when applying.";
          checkTransitionalLocation();
        }
      },
      {
        label:"They applied for the linked 500 SECONDARY before 2 October 2026 and it was granted on/after 2 October 2026",
        small:"The same primary applicant was the primary student",
        next:()=>{
          state.familyEligible=true;
          state.familyPathType="transitional_in_australia";
          state.familyReason="Transitional secondary pathway: the earlier secondary Student application was made before 2 October 2026 and granted on/after that date; the family applicant must be in Australia when applying.";
          checkTransitionalLocation();
        }
      },
      {
        label:"NO — neither of those applies",
        next:()=>{
          state.familyEligible=false;
          state.familyReason="NO — a current or newly granted linked secondary Student visa is not, by itself, a family pathway. The transitional linked-secondary pathway only covers the specified pre-2 October 2026 cases.";
          showResult();
        }
      }
    ]
  );
}

function checkTransitionalLocation(){
  if(state.primaryResult==="offshore"){
    state.familyEligible=false;
    state.familyReason="NO — the transitional linked-secondary pathway requires the partner/child to be in Australia when applying. The primary student must lodge offshore, and all Student family applicants must lodge at the same time and place as the primary. Therefore this transitional pathway cannot be used for the offshore combined application.";
    showResult();
    return;
  }
  askPartnerLocation();
}

function askPartnerLocation(){
  ask("Where is the partner / child now?","For a combined application, both must apply at the same time and place.",[
    {label:"Same place as the primary student",next:()=>{state.samePlace=true;askPartnerVisa();}},
    {label:"Different place",small:"One is in Australia and the other is offshore",next:()=>{
      state.samePlace=false;
      if(state.familyPathType==="transitional_in_australia"){
        state.familyEligible=false;
        state.familyReason="NO at present — this transitional family pathway requires the partner/child to be in Australia. They cannot be included while offshore. If they can lawfully return to Australia before lodgement, the case can be reassessed.";
        showResult();
      } else {
        askPartnerVisa();
      }
    }}
  ]);
}

function askPartnerVisa(){
  ask("What visa does the partner / child hold now?","This is a separate onshore-validity check. The transitional family pathway looks at what they held/applied for before 2 October 2026, but their current status must still allow an onshore application.",[
    {label:"Subclass 500 — SECONDARY linked to this primary student",next:()=>{state.partnerResult="onshore";state.partnerVisa="500 secondary";showResult();}},
    {label:"Subclass 500 — PRIMARY student on their own visa",next:()=>{state.partnerVisa="500 primary";state.partnerResult="onshore";showResult();}},
    {label:"482 / 485 / Visitor / Working Holiday / Training / Temporary Activity etc.",next:()=>{state.partnerVisa="prescribed visa";state.partnerResult="offshore";showResult();}},
    {label:"Another substantive visa",next:()=>{state.partnerVisa="other substantive";state.partnerResult="onshore";showResult();}},
    {label:"Only Bridging visa / no substantive visa",next:()=>{state.partnerVisa="no substantive";state.partnerResult="offshore";showResult();}}
  ]);
}

function showResult(){
  const renderer=()=>showResult();
  beginScreen(renderer);
  bar.style.width="100%";step.textContent="Result";pct.textContent="100%";track.setAttribute("aria-valuenow",100);
  let title,cls,icon,primaryText,familyText="Not included",combinedText="—",reason="";

  if(state.primaryResult==="onshore"){
    primaryText="YES — apply onshore";
  } else {
    primaryText="NO onshore — apply offshore";
  }

  if(!state.family){
    title=state.primaryResult==="onshore"?"YES — APPLY ONSHORE":"NO — APPLY OFFSHORE";
    cls=state.primaryResult==="onshore"?"green":"amber";
    icon=state.primaryResult==="onshore"?"✓":"↗";
    reason=state.primaryReason||"";
  } else if(state.familyEligible===false){
    familyText="NO — cannot be included";
    combinedText="Primary applies alone";
    title=state.primaryResult==="onshore"?"PRIMARY: YES ONSHORE • PARTNER: NO":"PRIMARY: OFFSHORE • PARTNER: NO";
    cls="amber"; icon="!";
    reason=state.familyReason;
  } else {
    familyText="YES — can be included";
    const primaryNeedsOffshore=state.primaryResult==="offshore";
    const partnerNeedsOffshore=state.partnerResult==="offshore";

    if(primaryNeedsOffshore||partnerNeedsOffshore){
      combinedText="Both apply offshore together";
      title="YES — APPLY TOGETHER, BUT OFFSHORE";
      cls="amber";icon="↗";
      reason="A family pathway exists, but at least one person cannot lodge onshore. Because the application must be together, both should lodge offshore.";
    } else if(state.samePlace===false){
      combinedText="Must first be in the same place";
      title="YES — BUT BOTH MUST BE IN THE SAME PLACE";
      cls="amber";icon="↔";
      reason="Both appear eligible, but a combined application must be lodged at the same time and place.";
    } else {
      combinedText="YES — apply together onshore";
      title="YES — APPLY TOGETHER ONSHORE";
      cls="green";icon="✓";
      reason="Primary and family applicant appear to meet the location rules and a permitted family pathway has been identified.";
    }
  }

  area.innerHTML=`
    <div class="result ${cls}">
      <div class="result-head"><div class="icon" aria-hidden="true">${icon}</div><h2>${title}</h2></div>
      <div class="boxes">
        <div class="box"><div class="label">Primary student</div><div class="value">${esc(primaryText)}</div></div>
        ${state.family?`<div class="box"><div class="label">Partner / child</div><div class="value">${esc(familyText)}</div></div>`:""}
        ${state.family?`<div class="box"><div class="label">Combined application</div><div class="value">${esc(combinedText)}</div></div>`:""}
      </div>
      <div class="reason"><strong>Why?</strong><br>${esc(reason || state.primaryReason || "")}</div>
      ${state.family&&state.familyReason?`<div class="note"><strong>Family rule:</strong> ${esc(state.familyReason)}</div>`:""}
      ${state.familyPathType==="transitional_in_australia"&&state.primaryResult==="offshore"?`<div class="note"><strong>Key point:</strong> Existing linked-secondary transitional cases require the family applicant to be <strong>in Australia</strong>. They cannot simply follow the primary applicant offshore and keep using that pathway.</div>`:""}
      <div class="note"><strong>Very simple rule for extension cases:</strong><br>
      Same provider + qualifying principal course + less than 12 months remaining = <strong>ONSHORE</strong>.<br>
      Changed provider = <strong>OFFSHORE</strong>.<br>
      12 months or more remaining = <strong>OFFSHORE</strong>.</div>

      <div id="printMeta" class="print-meta" aria-hidden="true"></div>
    </div>
    <div class="actions result-actions">
      <button class="btn primary" onclick="openPrintModal()">Print / Save</button>
      <button class="btn light" onclick="restartAll()">Check another person</button>
    </div>`;
  focusArea();
}


function formatGeneratedDate(date=new Date()){
  return new Intl.DateTimeFormat(undefined, {
    day:"2-digit",
    month:"long",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  }).format(date);
}

function validatePhoneNumber(value){
  const raw=value.trim();
  if(!raw) return {valid:false,message:"Phone number is required."};
  if(!/^[+()\-\s\d]+$/.test(raw)){
    return {valid:false,message:"Use only numbers, spaces, +, -, or brackets."};
  }
  const digits=raw.replace(/\D/g,"");
  if(digits.length<8 || digits.length>15){
    return {valid:false,message:"Enter a valid phone number with 8 to 15 digits."};
  }
  return {valid:true,message:""};
}

function validateEmail(value){
  const raw=value.trim();
  if(!raw) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
}

function ensurePrintModal(){
  let modal=document.getElementById("printModal");
  if(modal) return modal;

  modal=document.createElement("div");
  modal.id="printModal";
  modal.className="modal-overlay";
  modal.setAttribute("aria-hidden","true");
  modal.innerHTML=`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="printModalTitle">
      <button class="modal-close" id="printModalClose" type="button" aria-label="Close">×</button>
      <div class="modal-kicker">Print details</div>
      <h2 id="printModalTitle">Enter applicant details</h2>
      <p class="modal-help">Name and phone number are required before the result can be printed or saved as PDF.</p>

      <form id="printForm" novalidate>
        <div class="form-group">
          <label for="printName">Name <span class="required">*</span></label>
          <input id="printName" class="input" type="text" autocomplete="name" maxlength="120" placeholder="Applicant name">
          <div class="field-error" id="printNameError"></div>
        </div>

        <div class="form-group">
          <label for="printPhone">Phone number <span class="required">*</span></label>
          <input id="printPhone" class="input" type="tel" autocomplete="tel" maxlength="25" placeholder="e.g. +61 4XX XXX XXX">
          <div class="field-error" id="printPhoneError"></div>
        </div>

        <div class="form-group">
          <label for="printEmail">Email <span class="optional">(optional)</span></label>
          <input id="printEmail" class="input" type="email" autocomplete="email" maxlength="160" placeholder="name@example.com">
          <div class="field-error" id="printEmailError"></div>
        </div>

        <div class="generation-date-row">
          <span>Date of generation</span>
          <strong id="printGeneratedDate"></strong>
        </div>

        <div class="modal-actions">
          <button class="btn light" id="printCancel" type="button">Cancel</button>
          <button class="btn primary" type="submit">Continue to Print</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);

  const close=()=>closePrintModal();
  document.getElementById("printModalClose").onclick=close;
  document.getElementById("printCancel").onclick=close;
  modal.addEventListener("click",e=>{if(e.target===modal) close();});

  document.getElementById("printForm").addEventListener("submit",e=>{
    e.preventDefault();
    submitPrintDetails();
  });

  return modal;
}

function openPrintModal(){
  const modal=ensurePrintModal();
  const generatedAt=new Date();
  modal.dataset.generatedAt=generatedAt.toISOString();
  document.getElementById("printGeneratedDate").textContent=formatGeneratedDate(generatedAt);

  ["printNameError","printPhoneError","printEmailError"].forEach(id=>{
    document.getElementById(id).textContent="";
  });
  ["printName","printPhone","printEmail"].forEach(id=>{
    document.getElementById(id).classList.remove("invalid");
  });

  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  setTimeout(()=>document.getElementById("printName").focus(),0);
}

function closePrintModal(){
  const modal=document.getElementById("printModal");
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}

function submitPrintDetails(){
  const nameEl=document.getElementById("printName");
  const phoneEl=document.getElementById("printPhone");
  const emailEl=document.getElementById("printEmail");

  const name=nameEl.value.trim();
  const phone=phoneEl.value.trim();
  const email=emailEl.value.trim();
  let valid=true;

  const setError=(el,errorId,message)=>{
    el.classList.toggle("invalid",Boolean(message));
    document.getElementById(errorId).textContent=message;
    if(message) valid=false;
  };

  setError(nameEl,"printNameError",name.length<2?"Name is required.":"");

  const phoneCheck=validatePhoneNumber(phone);
  setError(phoneEl,"printPhoneError",phoneCheck.message);

  setError(emailEl,"printEmailError",validateEmail(email)?"":"Enter a valid email address or leave it blank.");

  if(!valid) return;

  const modal=document.getElementById("printModal");
  const generatedAt=modal?.dataset.generatedAt?new Date(modal.dataset.generatedAt):new Date();
  const meta=document.getElementById("printMeta");
  if(meta){
    meta.innerHTML=`
      <div class="print-meta-title">Applicant Details</div>
      <div class="print-meta-grid">
        <div><span>Name</span><strong>${esc(name)}</strong></div>
        <div><span>Phone</span><strong>${esc(phone)}</strong></div>
        ${email?`<div><span>Email</span><strong>${esc(email)}</strong></div>`:""}
        <div><span>Date of generation</span><strong>${esc(formatGeneratedDate(generatedAt))}</strong></div>
      </div>`;
  }

  closePrintModal();
  setTimeout(()=>window.print(),80);
}

window.openPrintModal=openPrintModal;
window.closePrintModal=closePrintModal;

document.addEventListener("keydown",e=>{
  if(e.key==="Escape") closePrintModal();
});

function restartAll(){
  Object.keys(state).forEach(k=>delete state[k]);
  q=0;
  screenHistory=[];
  currentScreen=null;
  restoring=false;
  backBtn.hidden=true;
  start();
}
window.restartAll=restartAll;
backBtn.onclick=goBack;
document.getElementById("restart").onclick=restartAll;
start();
