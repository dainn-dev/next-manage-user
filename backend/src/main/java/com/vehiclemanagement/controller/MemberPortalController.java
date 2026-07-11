package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.MemberClaimSessionRequest;
import com.vehiclemanagement.dto.MemberParkingSessionDto;
import com.vehiclemanagement.dto.MemberVehicleGarageDto;
import com.vehiclemanagement.entity.ParkingSession;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.parking.ParkingFeeService;
import com.vehiclemanagement.service.MemberPortalQueryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * MEMBER consumer portal APIs (garage, visit claim / history). ADR-0604.
 */
@RestController
@RequestMapping("/api/member")
@PreAuthorize("hasRole('MEMBER')")
public class MemberPortalController {

    private final MemberPortalQueryService memberPortalQueryService;
    private final ParkingFeeService parkingFeeService;

    public MemberPortalController(
            MemberPortalQueryService memberPortalQueryService,
            ParkingFeeService parkingFeeService) {
        this.memberPortalQueryService = memberPortalQueryService;
        this.parkingFeeService = parkingFeeService;
    }

    @GetMapping("/vehicles")
    public List<MemberVehicleGarageDto> garage(Authentication authentication) {
        return memberPortalQueryService.listGarage(requireMemberId(authentication));
    }

    @GetMapping("/sessions")
    public List<MemberParkingSessionDto> sessions(Authentication authentication) {
        return memberPortalQueryService.listSessions(requireMemberId(authentication));
    }

    @GetMapping("/sessions/{sessionId}")
    public MemberParkingSessionDto session(
            @PathVariable UUID sessionId, Authentication authentication) {
        return memberPortalQueryService.requireOwnedSession(requireMemberId(authentication), sessionId);
    }

    @PostMapping("/sessions/claim")
    public MemberParkingSessionDto claim(
            @Valid @RequestBody MemberClaimSessionRequest request, Authentication authentication) {
        UUID memberId = requireMemberId(authentication);
        UUID sessionId = memberPortalQueryService.resolveSessionIdFromCode(request.getCode());
        ParkingSession claimed = parkingFeeService.claimSession(sessionId, memberId);
        return memberPortalQueryService.requireOwnedSession(memberId, claimed.getId());
    }

    private static UUID requireMemberId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        if (user.getRole() != User.Role.MEMBER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return user.getId();
    }
}
