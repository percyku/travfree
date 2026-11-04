package com.percyku.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;
import com.percyku.backend.repository.UserRepository;

/** 建立預設 admin。帳號已存在就不動，避免覆蓋日後修改過的密碼。 */
@Component
public class AdminSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final AppProperties.Admin admin;

	public AdminSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder, AppProperties properties) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.admin = properties.admin();
	}

	@Override
	public void run(ApplicationArguments args) {
		if (userRepository.existsByEmail(admin.email())) {
			return;
		}
		userRepository.save(new User(admin.email(), passwordEncoder.encode(admin.password()), Role.ADMIN));
		log.info("已建立預設 admin 帳號: {}", admin.email());
	}
}
