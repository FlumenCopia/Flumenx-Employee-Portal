"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useWebRTCCall } from "./useWebRTCCall";
import { DirectCallModal } from "./DirectCallModal";

export function GlobalIncomingCallListener() {
  const pathname = usePathname();
  const { activeCall, localStream, remoteStream, acceptCall, endCall } = useWebRTCCall();

  // If user is already on /chat or /meet/code, let the dedicated page handle it
  // Otherwise, display global incoming call modal
  if (!activeCall) return null;

  return (
    <DirectCallModal
      mode={activeCall.mode}
      callType={activeCall.callType}
      partnerName={activeCall.partnerName}
      partnerAvatar={activeCall.partnerAvatar}
      onAccept={acceptCall}
      onDecline={endCall}
      onEndCall={endCall}
      localStream={localStream}
      remoteStream={remoteStream}
    />
  );
}
