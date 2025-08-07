# 彭云
## Tencent
## Main Focus
3d Human reconstruct,Text2Video,Image2Human,Image2Motion etc...

some useful codes for better work with ue.

Current Main Digital Human Interact Process
```mermaid
sequenceDiagram
UserInput->>ASR :  Vocie To Text
ASR->>LLM : Interact Dialog
UserInput->>LLM : Input Text Dialog
LLM->>TTS: Answer: Text 2 Speech
TTS->>Audio2Lip: Audio 2 Lip params
TTS->>Audio2Expression: Feeling analysis To Expressions
TTS->>Audio2Motion: Audio Transform to Motion
Audio2Lip->>GroupedFrame: ArrangePrepare
Audio2Expression->>GroupedFrame: ArrangePrepare
Audio2Motion->>GroupedFrame: ArrangePrepare
GroupedFrame->>Renderer: Render Frame To Image
Renderer->>VideoEncode: Add Audio,encode to Mp4
```

Image/Video to 3d assets,make benifit of this assets is my main point.


git clone https://chromium.googlesource.com/libyuv/libyuv
