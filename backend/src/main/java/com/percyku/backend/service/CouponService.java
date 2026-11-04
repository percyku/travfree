package com.percyku.backend.service;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.CouponRequest;
import com.percyku.backend.dto.CouponResponse;
import com.percyku.backend.dto.PagedResult;
import com.percyku.backend.entity.Coupon;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.CartItemRepository;
import com.percyku.backend.repository.CouponRepository;

@Service
@Transactional(readOnly = true)
public class CouponService {

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

	private final CouponRepository couponRepository;
	private final CartItemRepository cartItemRepository;

	public CouponService(CouponRepository couponRepository, CartItemRepository cartItemRepository) {
		this.couponRepository = couponRepository;
		this.cartItemRepository = cartItemRepository;
	}

	public PagedResult<CouponResponse> page(String page) {
		return PagedResult.fetch(page, null, NEWEST_FIRST, couponRepository::findAll, CouponResponse::from);
	}

	@Transactional
	public void create(CouponRequest request) {
		if (couponRepository.existsByCode(request.code())) {
			throw ApiException.badRequest("code 已存在");
		}
		Coupon coupon = new Coupon();
		coupon.apply(request);
		couponRepository.save(coupon);
	}

	@Transactional
	public void update(String id, CouponRequest request) {
		Coupon coupon = couponRepository.findById(id)
				.orElseThrow(() -> ApiException.notFound("id 不存在"));
		if (couponRepository.existsByCodeAndIdNot(request.code(), id)) {
			throw ApiException.badRequest("code 已存在");
		}
		coupon.apply(request);
	}

	@Transactional
	public void delete(String id) {
		if (!couponRepository.existsById(id)) {
			throw ApiException.notFound("找不到優惠券");
		}
		cartItemRepository.clearCoupon(id);
		couponRepository.deleteById(id);
	}
}
