package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.CreateUserRequest;
import com.vehiclemanagement.dto.UpdateUserRequest;
import com.vehiclemanagement.dto.UserDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserService implements UserDetailsService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username: " + username));
    }
    
    public Page<UserDto> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserDto::new);
    }
    
    public List<UserDto> getAllUsersList() {
        return userRepository.findAll().stream()
                .map(UserDto::new)
                .collect(Collectors.toList());
    }
    
    public UserDto getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return new UserDto(user);
    }
    
    public UserDto getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));
        return new UserDto(user);
    }
    
    public Page<UserDto> searchUsers(String searchTerm, Pageable pageable) {
        return userRepository.findBySearchTerm(searchTerm, pageable).map(UserDto::new);
    }
    
    public Page<UserDto> getUsersByRole(User.Role role, Pageable pageable) {
        return userRepository.findByRole(role, pageable).map(UserDto::new);
    }
    
    public Page<UserDto> getUsersByStatus(User.UserStatus status, Pageable pageable) {
        return userRepository.findByStatus(status, pageable).map(UserDto::new);
    }
    
    public UserDto createUser(CreateUserRequest request) {
        // Check if username already exists
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }
        
        // Check if email already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }
        
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(request.getRole())
                .status(request.getStatus())
                .build();
        
        // Link to employee if provided
        if (request.getEmployeeId() != null) {
            Employee employee = employeeRepository.findById(request.getEmployeeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + request.getEmployeeId()));
            user.setEmployee(employee);
        }
        
        User savedUser = userRepository.save(user);
        return new UserDto(savedUser);
    }
    
    public UserDto updateUser(UUID id, UpdateUserRequest request) {
        User existingUser = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        // Check if username already exists (excluding current user)
        if (request.getUsername() != null && !existingUser.getUsername().equals(request.getUsername()) &&
            userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists: " + request.getUsername());
        }
        
        // Check if email already exists (excluding current user)
        if (request.getEmail() != null && !existingUser.getEmail().equals(request.getEmail()) &&
            userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }
        
        // Update fields if provided
        if (request.getUsername() != null) {
            existingUser.setUsername(request.getUsername());
        }
        if (request.getEmail() != null) {
            existingUser.setEmail(request.getEmail());
        }
        if (request.getPassword() != null) {
            existingUser.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getFirstName() != null) {
            existingUser.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            existingUser.setLastName(request.getLastName());
        }
        if (request.getRole() != null) {
            existingUser.setRole(request.getRole());
        }
        if (request.getStatus() != null) {
            existingUser.setStatus(request.getStatus());
        }
        
        // Update employee link if provided
        if (request.getEmployeeId() != null) {
            Employee employee = employeeRepository.findById(request.getEmployeeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + request.getEmployeeId()));
            existingUser.setEmployee(employee);
        }
        
        User updatedUser = userRepository.save(existingUser);
        return new UserDto(updatedUser);
    }
    
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User not found with id: " + id);
        }
        userRepository.deleteById(id);
    }
    
    public boolean checkUsernameExists(String username) {
        return userRepository.existsByUsername(username);
    }
    
    public boolean checkEmailExists(String email) {
        return userRepository.existsByEmail(email);
    }
    
    public long getUserCountByRole(User.Role role) {
        return userRepository.countByRole(role);
    }
    
    public long getUserCountByStatus(User.UserStatus status) {
        return userRepository.countByStatus(status);
    }
    
    public UserDto updateUserStatus(UUID id, User.UserStatus status) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        user.setStatus(status);
        User updatedUser = userRepository.save(user);
        return new UserDto(updatedUser);
    }
    
    public UserDto updateUserRole(UUID id, User.Role role) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        
        user.setRole(role);
        User updatedUser = userRepository.save(user);
        return new UserDto(updatedUser);
    }
    
    public void updateLastLogin(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
        }
    }
    
    // Bulk operations
    public void bulkDeleteUsers(List<UUID> userIds) {
        for (UUID id : userIds) {
            if (userRepository.existsById(id)) {
                userRepository.deleteById(id);
            }
        }
    }
    
    public List<UserDto> bulkUpdateUserStatus(List<UUID> userIds, User.UserStatus status) {
        List<User> users = userRepository.findAllById(userIds);
        
        for (User user : users) {
            user.setStatus(status);
        }
        
        List<User> updatedUsers = userRepository.saveAll(users);
        return updatedUsers.stream().map(UserDto::new).collect(Collectors.toList());
    }
    
    public List<UserDto> bulkUpdateUserRole(List<UUID> userIds, User.Role role) {
        List<User> users = userRepository.findAllById(userIds);
        
        for (User user : users) {
            user.setRole(role);
        }
        
        List<User> updatedUsers = userRepository.saveAll(users);
        return updatedUsers.stream().map(UserDto::new).collect(Collectors.toList());
    }
}
