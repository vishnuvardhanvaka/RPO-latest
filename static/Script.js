 // Function to call the API and highlight the sentence
 function callAPI(sentence, speakerSeparation) {
    // Prepare payload
    const payload = {
        "sentence": sentence,
        "speakerTranscription": speakerSeparation
    };

    // Make a POST request to the backend API
    fetch('/matching', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Handle response from API
            console.log('API Response:', data);

            // Iterate over each speaker separation index
            Object.keys(data).forEach(speakerIndex => {
                const highlights = data[speakerIndex];

                // Get the current speaker's transcription
                const speakerTranscriptionDiv = document.getElementById('speakerTranscription');
                const transcriptionElement = speakerTranscriptionDiv.children[speakerIndex];

                // Get the current speaker's transcription text content
                let transcriptionText = transcriptionElement.textContent;

                // Create a new string to hold the highlighted transcription
                let highlightedTranscription = '';

                let currentIndex = 0;

                // Apply highlighting to the relevant parts of the transcription
                highlights.forEach(highlight => {
                    const startIndex = highlight[0];
                    const endIndex = highlight[1];

                    // Append the text before the highlight
                    highlightedTranscription += transcriptionText.substring(currentIndex, startIndex);

                    // Append the highlighted text
                    highlightedTranscription += '<span style="background-color: yellow;">' +
                        transcriptionText.substring(startIndex, endIndex + 1) + '</span>';

                    // Update the current index
                    currentIndex = endIndex + 1;
                });

                // Append any remaining text after the last highlight
                highlightedTranscription += transcriptionText.substring(currentIndex);

                // Update the speaker's transcription with the highlighted version
                transcriptionElement.innerHTML = highlightedTranscription;
            });

            // Add event listener to remove highlighting when the mouse moves away from the transcription area
            const speakerTranscriptionDiv = document.getElementById('speakerTranscription');
            speakerTranscriptionDiv.addEventListener('mousemove', function (event) {
                const target = event.target;
                if (!target.closest('span')) { // If the mouse is not over a highlighted area
                    // Restore the default transcription for all speaker elements
                    Object.keys(data).forEach(speakerIndex => {
                        const transcriptionElement = speakerTranscriptionDiv.children[speakerIndex];
                        transcriptionElement.innerHTML = transcriptionElement.textContent;
                    });
                }
            });
        })
        .catch(error => {
            console.error('Error sending data to API:', error);
        });
}



$(document).ready(function () {
    var isAudioRecorded = false; // Flag to track if audio is recorded
    var isRecordingInProgress = false; // Flag to track if recording is in progress
    var isTranscriptionDone = false; // Flag to track if transcription is done for the current recording session

    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;
    let timerInterval;
    let secondsElapsed = 0;

    function startTimer() {
        secondsElapsed = 0;
        timerInterval = setInterval(() => {
            secondsElapsed++;
            let minutes = Math.floor(secondsElapsed / 60);
            let seconds = secondsElapsed % 60;
            let formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            $('#timer').text(formattedTime);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        $('#timer').text('00:00');
    }

    $('#recordBtn').click(async function () {
        if (isRecordingInProgress) {
            // Stop recording
            mediaRecorder.stop();
            $('#recordBtn').text('Start Recording');
            $('#recordingSymbol').hide(); // Hide recording symbol
            stopTimer();
        } else {
            // Start recording
            let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                let audioUrl = URL.createObjectURL(audioBlob);
                $('#audioPlayer source').attr('src', audioUrl);
                $('#audioPlayer')[0].load();
                $('#audioPlayer')[0].play();
                $('#audioPlayer').show();

                var downloadBtn = $('<button>')
                    .addClass('button')
                    .text('Download Audio')
                    .click(function () {
                        var link = document.createElement('a');
                        link.href = audioUrl;
                        link.download = 'recorded_audio.wav';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    });
                $('.button-container').append(downloadBtn);

                audioChunks = [];
                isAudioRecorded = true; // Set flag to true after successful recording
                isTranscriptionDone = false; // Reset transcription flag for new recording session
                $('#transcribeBtn').prop('disabled', false); // Enable transcription button
                $('#messageArea').text(''); // Clear message area
            };

            mediaRecorder.start();
            $('#recordBtn').text('Stop Recording');
            $('#recordingSymbol').show(); // Show recording symbol
            startTimer();
        }
        isRecordingInProgress = !isRecordingInProgress;
    });

    $('#transcribeBtn').click(function () {
        console.log("Transcribe button clicked."); // Debug log
        console.log("isAudioRecorded:", isAudioRecorded); // Debug log
        if (!isAudioRecorded) {
            console.log("Please record audio first."); // Debug log
            showMessage("Please record audio first.");
            console.log("Message set to Please record audio first."); // Debug log
            return;
        }
        if (isTranscriptionDone) {
            console.log("Transcription already done for this recording."); // Debug log
            showMessage("Transcription already done for this recording.");
            return;
        }
        var reader = new FileReader();
        reader.onload = function(event) {
            var audioData = event.target.result;
            $.ajax({
                url: '/transcribe_audio',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ 'audioFile': audioData }),
                success: function (data) {
                    const speakerTranscription = data.speakerTranscription;
                    const speakerTranscriptionDiv = document.getElementById('speakerTranscription');
                    speakerTranscription.forEach((transcription, index) => {
                        const p = document.createElement('p');
                        p.textContent = transcription;
                        speakerTranscriptionDiv.appendChild(p);
                    });
                    document.getElementById('json-display').innerHTML = generateHTML(data);

                    // Mouseover event handling
                    document.querySelectorAll('.hoverable').forEach(span => {
                        span.addEventListener('mouseover', function () {
                            console.log("Mouse over: " + this.textContent);
                            this.style.color = 'red'; // Change text color to red on hover
                            const index = $(this).index('.hoverable');
                            callAPI(this.textContent, data.speakerTranscription, index);
                        });

                        span.addEventListener('mouseout', function () {
                            this.style.color = 'black'; // Revert text color on mouse out
                        });
                    });

                    isTranscriptionDone = true; // Set transcription flag after transcription is done
                },
                error: function (xhr, status, error) {
                    console.error(xhr.responseText);
                    $('#messageArea').text("Error occurred during transcription.");
                }
            });
        };
        reader.readAsDataURL(audioBlob);
    });

    function showMessage(message) {
        console.log("showMessage called with message:", message); // Debug log
        $('#messageArea').text(message);
    }

    $(document).ready(function(){
        // Event listener for the redirect button
        $('#redirectBtn').click(function(){
            window.location.href = 'https://openemr.rap-ai.com/';
        })
    })

    // Function to show the button dynamically
    function showEMSbtn(){
        $('.button-right-corner').show();
    }

    // Function to generate HTML from JSON data
    function generateHTML(jsonData) {
        let html = '<ul>';
        for (const key in jsonData) {
            if (key === 'clinicalSummary') {
                html += `<li><strong>${key}</strong>: `;
                if (typeof jsonData[key] === 'object') {
                    html += '<ul>';
                    for (const subKey in jsonData[key]) {
                        html += `<li><strong>${subKey}</strong>:<span class="hoverable">${jsonData[key][subKey]}</span></li>`;
                    }
                    html += '</ul>';
                }
                else {
                    html += `${jsonData[key]}</li>`;
                }
            }
        }
        html += '</ul>';
        for (const key in jsonData) {
            if (key === 'icdCodes') {
                html += `<li><strong>${key}</strong>: `;
                if (typeof jsonData[key] === 'object') {
                    html += '<ul>';
                    for (const subKey in jsonData[key]) {
                        html += `<li> ${jsonData[key][subKey]}</li>`;
                    }
                    html += '</ul>';
                }
                else {
                    html += `${jsonData[key]}</li>`;
                }
            }
        }
        html += '</ul>';
        showEMSbtn();
        return html;
    }
});


