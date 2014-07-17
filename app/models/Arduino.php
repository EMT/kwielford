<?php

namespace app\models;

class Arduino extends \lithium\data\Model {

	public $validates = array();

    public static function write($data) {
        if (isset($data['mood'])) {
            file_get_contents('http://10.0.1.52/?mood=' . $data['mood']);
        }
    }
}

?>