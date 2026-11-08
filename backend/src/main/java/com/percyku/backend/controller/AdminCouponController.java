package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.CouponRequest;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.service.CouponService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminCouponController {

	private final CouponService couponService;

	public AdminCouponController(CouponService couponService) {
		this.couponService = couponService;
	}

	@GetMapping("/coupons")
	public Map<String, Object> page(@RequestParam(required = false) String page) {
		return ApiResponses.pageWithMessages("coupons", couponService.page(page));
	}

	@PostMapping("/coupon")
	public Map<String, Object> create(@Valid @RequestBody DataRequest<CouponRequest> request) {
		couponService.create(request.data());
		return ApiResponses.message("已建立優惠券");
	}

	@PutMapping("/coupon/{id}")
	public Map<String, Object> update(@PathVariable String id,
			@Valid @RequestBody DataRequest<CouponRequest> request) {
		couponService.update(id, request.data());
		return ApiResponses.message("已更新優惠券");
	}

	@DeleteMapping("/coupon/{id}")
	public Map<String, Object> delete(@PathVariable String id) {
		couponService.delete(id);
		return ApiResponses.message("已刪除優惠券");
	}
}
