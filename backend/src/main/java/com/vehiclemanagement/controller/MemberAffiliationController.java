package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.MemberAffiliationDto;
import com.vehiclemanagement.dto.MemberAffiliationInviteRequest;
import com.vehiclemanagement.service.MemberAffiliationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/member-affiliations")
@PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
public class MemberAffiliationController {

    private final MemberAffiliationService memberAffiliationService;

    public MemberAffiliationController(MemberAffiliationService memberAffiliationService) {
        this.memberAffiliationService = memberAffiliationService;
    }

    @GetMapping
    public List<MemberAffiliationDto> list() {
        return memberAffiliationService.listForCurrentTenant();
    }

    @PostMapping("/invite")
    public ResponseEntity<MemberAffiliationDto> invite(
            @Valid @RequestBody MemberAffiliationInviteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(memberAffiliationService.inviteOrLink(request));
    }

    @DeleteMapping("/{userId}")
    public MemberAffiliationDto revoke(@PathVariable UUID userId) {
        return memberAffiliationService.revoke(userId);
    }
}
