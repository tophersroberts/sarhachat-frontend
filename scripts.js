/* Anonymous usage counts. Records that an event happened, never what
   the user typed: the allow-list below is the only thing that can be
   counted or sent, so message text cannot leak in. */
var Usage = (function () {
  // Collector URL. Empty = counts stay in this tab only.
  var ENDPOINT = "";
  var EVENTS = [
    "chat_open",
    "chat_message_sent",
    "chat_close",
    "locator_view",
    "locator_use",
  ];
  var counts = {};
  try {
    counts = JSON.parse(sessionStorage.getItem("sarha-usage") || "{}");
  } catch (e) {}

  function record(name) {
    if (EVENTS.indexOf(name) < 0) return;
    counts[name] = (counts[name] || 0) + 1;
    try {
      sessionStorage.setItem("sarha-usage", JSON.stringify(counts));
    } catch (e) {}
  }

  window.addEventListener("pagehide", function () {
    if (ENDPOINT && navigator.sendBeacon) {
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([JSON.stringify(counts)], { type: "application/json" })
      );
    }
  });

  return { record: record, counts: counts };
})();

// The locator is cross-origin, so focus moving into it is the only
// signal available — what the user searches is never visible here.
window.addEventListener("blur", function () {
  if (document.activeElement === document.getElementById("locator-widget")) {
    Usage.record("locator_use");
  }
});

function showLocator(show) {
  var panel = document.getElementById("locator-panel");
  var chat = document.querySelector(".chat-window");
  show = Boolean(show && chat && window.getComputedStyle(chat).display !== "none");
  panel.hidden = !show;
  panel.classList.toggle("open", show);
  var btn = document.getElementById("locator-toggle");
  if (btn) {
    btn.classList.toggle("active", show);
    btn.setAttribute("aria-pressed", show ? "true" : "false");
  }
  if (show) {
    placeLocator();
    Usage.record("locator_view");
  }
}

// Header pin: reveal the locator on demand, tap again to dismiss.
function toggleLocator() {
  var panel = document.getElementById("locator-panel");
  showLocator(!panel.classList.contains("open"));
}

// Sit just left of the chat window, bottoms aligned.
function placeLocator() {
  var panel = document.getElementById("locator-panel");
  if (!panel.classList.contains("open")) return;
  // On small screens the CSS docks it to the bottom; clear any
  // inline left/top left over from desktop so the CSS wins.
  if (window.innerWidth <= 900) {
    panel.style.left = "";
    panel.style.top = "";
    return;
  }
  var chat = document.querySelector(".chat-window").getBoundingClientRect();
  panel.style.left =
    Math.max(12, chat.left - panel.offsetWidth - 12) + "px";
  panel.style.top =
    Math.max(12, chat.bottom - panel.offsetHeight) + "px";
}

window.addEventListener("resize", placeLocator);

function flipCard(card) {
  card.classList.toggle("flipped");
}

function showPrivacyPolicy() {
    $("#privacyPolicy").modal("show");
}

function hidePrivacyPolicy() {
    $("#privacyPolicy").modal("hide");
}

function showMissionStatement() {
    $("#missionStatement").modal("show");
}

function hideMissionStatement() {
    $("#missionStatement").modal("hide");
}

function showFAQ() {
    $("#faqModal").modal("show");
}

function hideFAQ() {
    $("#faqModal").modal("hide");
}

function showAboutTeam() {
    $("#aboutTeamModal").modal("show");
}

let legalStatementPresented = 0;

async function startChat(event) {
  if ((legalStatementPresented === undefined) 
   || (legalStatementPresented === 0        )) {
    $("#legalStatement").modal("show");
  } else {
    openChat(event);
  }
}

async function closeModal(event) {
  $("#legalStatement").modal("hide");
  legalStatementPresented = 0;
}

let openingMsgSent = 0;

async function openChat(event) {
  legalStatementPresented = 1;

  document.getElementById("open-button").innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Opening...';
  document.getElementById("open-button").disabled = true;

  const token = sessionStorage.getItem("sarha-auth-token");
  if (await verifyToken(token)) {
    document.querySelector(".chat-window").style.display = "block";
    document.querySelector(".overlay").style.display = "block";
    document.getElementById("open-button").style.display = "none";
    document.getElementById("open-button").disabled = false;
    document.getElementById("open-button").innerHTML = "<img src='Images/swirl.png' alt='Chat Icon' class='chat-icon' />Chat with SARHAchat";
    document.querySelector(".user-message").focus();
    Usage.record("chat_open");

    if (openingMsgSent === 0) {
      addTypingIndicator();
      setTimeout(function () {
        removeTypingIndicator();
        addMessage(
          `Hi! How can I help you with your sexual and reproductive health today?
                
          - Answer questions: Ask me any question about your body, sex, periods, pregnancy, STIs, birth control, or anything related
          - Birth control help: We can talk about your health, what you need, and what might work best for your life. Then we'll find birth control options that fit you.

          <br><br>Just let me know which one feels right — Answering questions or Birth control help. También puedo ayudarte en español.`,
          0
        );
      }, 1500);
      openingMsgSent = 1;
    }
  } else {
    await authorizeChat(event);
  }
}

async function authorizeChat(event) {
  event.preventDefault();
  grecaptcha.ready(function () {
    grecaptcha
      .execute("6LdOlQsqAAAAAIdOYPixmKb_vzOQvq7CaXlv_SJG", { action: "submit" })
      .then(async function (googleToken) {
        const authUrl =
          "https://ud2krsh537.execute-api.us-east-1.amazonaws.com/production/api/authorize";
        const postData = { token: googleToken };
        const headers = { headers: { "Content-Type": "application/json" } };

        try {
          const response = await axios.post(authUrl, postData, headers);

          if ("token" in response.data) {
            sessionStorage.setItem("sarha-auth-token", response.data.token);
          }
        } catch (error) {
          alert("Error in authorizeChat(): " + JSON.stringify(error));
        }

        openChat();
      });
  });
}

async function verifyToken(authToken) {
  const authUrl =
    "https://ud2krsh537.execute-api.us-east-1.amazonaws.com/production/api/verify";
  const postData = { token: authToken };
  const headers = { headers: { "Content-Type": "application/json" } };

  try {
    const response = await axios.post(authUrl, postData, headers);
    if ("token_is_valid" in response.data) {
      return response.data.token_is_valid;
    } else {
      return false;
    }
  } catch (error) {
    alert("Error in verifyToken(): " + JSON.stringify(error));
  }
  return false;
}

function submitOnEnter(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage(event);
  }
}

let messages = [];
let currentStage = "";
let educationMode = false;

async function sendMessage(event) {
  const input = document.querySelector(".user-message");
  const text = input.value.trim();
  if (text !== "") {
    Usage.record("chat_message_sent");
    addMessage(text, 1);
    input.value = "";
    input.focus();

    addTypingIndicator();

    const authToken = sessionStorage.getItem("sarha-auth-token");

    let postData;

    if (currentStage !== "") {
      postData = {
        chat_history: messages,
        current_stage: currentStage,
        education_mode: educationMode,
        authentication_token: authToken,
      };
    } else {
      postData = {
        chat_history: messages,
        education_mode: educationMode,
        authentication_token: authToken,
      };
    }

    const chatUrl =
      "https://q6isljp5pvpfd557vf5e5oimsa0rlirv.lambda-url.us-east-1.on.aws";
    const headers = { headers: { "Content-Type": "application/json" } };

    try {
      const response = await axios.post(chatUrl, postData, headers);

      if ("attached_image_identifiers" in response.data) {
        if (response.data.attached_image_identifiers !== null) {
          removeTypingIndicator();
          addImages(response.data.attached_image_identifiers);
          addTypingIndicator();
        }
      }

      if ("response" in response.data || Array.isArray(response.data.response_chunks)) {
        removeTypingIndicator();
        const chunks = response.data.response_chunks;
        if (Array.isArray(chunks) && chunks.length > 0) {
          // Render each chunk as a separate assistant bubble
          chunks.forEach((chunk) => addMessage(chunk, 0));
        } else {
          addMessage(response.data.response, 0);
        }
      } else {
        removeTypingIndicator();
        alert(
          "Error no response from chatbot: " + JSON.stringify(response.data)
        );
      }

      if ("current_stage" in response.data) {
        currentStage = response.data.current_stage;
      }
      
      if ("education_mode" in response.data) {
        educationMode = response.data.education_mode;
      }

      if (currentStage === "PDF_GENERATION_PART") {
        if ("path_to_pdf" in response.data) {
          addPDF(response.data.path_to_pdf);
        }
      }
    } catch (error) {
      removeTypingIndicator();
      alert("Error in sendMessage(): " + JSON.stringify(error));
    }
  }
  event.preventDefault();
}

function addTypingIndicator() {
  let div = document.getElementById("typing-indicator");
  if (div === null) {
    const list = document.querySelector(".chat-conversation");
    list.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-message chat-message-sarha typing-indicator" id="typing-indicator">
                <span></span> 
            </div> `
    );

    list.scrollTop = list.scrollHeight + list.clientHeight;
  }
}

function removeTypingIndicator() {
  let div = document.getElementById("typing-indicator");
  if (div) {
    div.remove();
  }
}

function addMessage(text, isUser) {
  let messageRole = "system";
  let messageClass = "chat-message-sarha";
  let messageContent = text;

  if (isUser) {
    messageRole = "user";
    messageClass = "chat-message-user";
  } else {
    const boldMarkDownRegex = /\*\*(.*?)\*\*/g;
    if (boldMarkDownRegex.test(messageContent)) {
      const regexReplacements = [
        {
          regex: /\.([^.]+\? Otherwise, I will move [^.]+\.)/g,
          replaceFunc: (match, p1) => `.<br><br>${p1}`,
        },
        {
          regex: /\.([^.*]+\?)\s*$/,
          replaceFunc: (match, p1) => `.<br><br>${p1}`,
        },
        {
          regex: /(\d+\.\s*)\*\*(.*?)\*\*/g,
          replaceFunc: (match, p1, p2) => `<br><br>${p1}<b>${p2}</b>`,
        },
        {
          regex: /\*\*(\s*\d+\s*.*?)\*\*/g,
          replaceFunc: (match, p1) => `<br><br><b>${p1}</b>`,
        },
        {
          regex: /\s*-\s*\*\*(.*?)\*\*/g,
          replaceFunc: (match, p1) => `<br>• <b>${p1}</b>`,
        },
        {
          regex: /(\!|\.|\?)\s+\*\*(.*?)\*\*/g,
          replaceFunc: (match, p1, p2) => `${p1}<br><b>${p2}</b>`,
        },
        {
          regex: /\*\*(.*?)\*\*/g,
          replaceFunc: (match, p1) => `<b>${p1}</b>`,
        },
        {
          regex: /\s+-\s+/g,
          replaceFunc: (match) => `<br>• `,
        },
        {
          regex: /### ([^<])+/g,
          replaceFunc: (match, p1) => `<br><h4>${p1}</h4>`,
        },
      ];
      regexReplacements.forEach((replacement) => {
        messageContent = messageContent.replace(
          replacement.regex,
          replacement.replaceFunc
        );
      });
    }
    
    messageContent = messageContent.replace(/^(\s*<br\s*\/?>)+/gi, '').replace(/(\s*<br\s*\/?>)+\s*$/gi, '');

    const isOpening = messageContent.startsWith("Hi! How can I help you with your sexual");
    if (isOpening) {
      messageContent = messageContent.replace(
        /-\s*([^:\n]+):\s*([^\n]+)/g,
        '<br>• <b>$1</b>: $2'
      );
    }
  }

  const chat = {
    role: messageRole,
    content: messageContent,
    id: Date.now().toString(),
    feedback: "none",
  };
  messages.push(chat);

  const list = document.querySelector(".chat-conversation");
  list.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-message ${messageClass}" data-key="${chat.id}">
            <span>${chat.content}</span> 
            ${
              isUser
                ? `
        </div> `
                : `
            <div class="reactions">
                <div class="btn-group reactions-btn-group" role="group">
                    <button type="button" class="btn btn-link reactions-btn" id="${chat.id}-p" onclick="addReaction(${chat.id},'p','n')">
                        <i class="bi bi-hand-thumbs-up"></i>
                    </button> 
                    <button type="button" class="btn btn-link reactions-btn" id="${chat.id}-n" onclick="addReaction(${chat.id},'n','p')">
                        <i class="bi bi-hand-thumbs-down"></i>
                    </button> 
                </div>
            </div>
        </div>`
            }`
  );
  list.scrollTop = list.scrollHeight + list.clientHeight;
}

const contraceptiveMethods = {
  "[ARM_IMPLANT_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/implant_full.jpg",
  "[CERVICAL_CAP_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/cervical_cap_full.jpeg",
  "[PILLS]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/how_to_take_contraceptive_pills.jpeg",
  "[IUD_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/iuds_full.jpg",
  "[DIAPHRAGM_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/diaphragm_full.jpg",
  "[EXTERNAL_CONDOM_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/male_condom.jpeg",
  "[FERTILITY_AWARENESS_METHOD_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/natural_family_planning_calendar.jpeg",
  "[INTERNAL_CONDOMS_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/female_condom.jpeg",
  "[PATCH_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/patch.jpeg",
  "[PULLING_OUT_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/pulling_out.jpeg",
  "[SHOT_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/injectable.jpeg",
  "[SPERMICIDE_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/spermicides.jpeg",
  "[TUBAL_LIGATION_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/female_sterilisation.jpg",
  "[VAGINAL_RING_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/ring_full.jpg",
  "[VAGINAL_SPONGE_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/sponge_full.jpg",
  "[VASECTOMY_IMAGE]":
    "https://chatbot-content-storage.s3.amazonaws.com/images/male_sterilisation.jpeg",
};

function addImages(keys) {
  for (const key of keys) {
    if (key in contraceptiveMethods) {
      const url = contraceptiveMethods[key];
      addImage(url.trim());
    } else {
      alert('Error in addImage(): unexpected key "' + key + '"');
    }
  }
}

function addImage(url) {
  const messageClass = "chat-message-sarha";
  const messageId = Date.now().toString();

  const list = document.querySelector(".chat-conversation");
  list.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-message-img ${messageClass}" data-key="${messageId}">
            <img src="${url}"/>
        </div> `
  );
  list.scrollTop = list.scrollHeight + list.clientHeight;
}

function addPDF(url) {
  const messageClass = "chat-message-sarha";
  const messageId = Date.now().toString();

  const list = document.querySelector(".chat-conversation");
  list.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-message ${messageClass}" data-key="${messageId}">
            <a href="${url}" download>
                <i class="bi bi-file-earmark-medical" style="font-size: xx-large;"></i> Download PDF
            </a>
        </div> `
  );
  list.scrollTop = list.scrollHeight + list.clientHeight;
  setTimeout(function () {
    $("#feedbackSurvey").modal("show");
  }, 1000);
}

function addReaction(id, reaction, otherReaction) {
  const isVisible = document
    .getElementById(id + "-" + reaction)
    .classList.contains("visible");
  const otherIsVisible = document
    .getElementById(id + "-" + otherReaction)
    .classList.contains("visible");

  let reactionToApply = "none";

  if (isVisible) {
    document.getElementById(id + "-" + reaction).classList.remove("visible");
  } else {
    reactionToApply = reaction === "p" ? "positive" : "negative";
    document.getElementById(id + "-" + reaction).classList.add("visible");
    if (otherIsVisible) {
      document
        .getElementById(id + "-" + otherReaction)
        .classList.remove("visible");
    }
  }

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].id == id) {
      messages[i].feedback = reactionToApply;
    }
  }
}

function closeChat() {
  Usage.record("chat_close");
  showLocator(false);
  document.querySelector(".chat-window").style.display = "none";
  document.querySelector(".overlay").style.display = "none";
  document.getElementById("open-button").style.display = "block";
}
